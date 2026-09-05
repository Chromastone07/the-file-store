"use client";

import { useCallback, useRef } from 'react';
import {
  generateEncryptionKey,
  exportKeyToBase64,
  encryptData,
  encryptText as encryptTextCrypto,
  encryptWithPassword,
  hashString,
} from '@/lib/crypto';
import { uploadEncryptedFile, createDropRecord, createSecureText, destroyDrop, destroySecureText } from '@/lib/supabase';
import { generateSessionCode } from '@/lib/crypto';
import { generateShareLink, expiryFromSeconds, sanitizeFilename } from '@/lib/utils';
import { stripFileMetadata } from '@/lib/metadata';
import * as fflate from 'fflate';
import { PHANTOM_CONFIG } from '@/lib/config';
import { useGlobalSession, UploadPhase, UploadResult } from '@/context/GlobalSessionContext';
import { useSenderHistory } from './useSenderHistory';

// Re-export types so we don't break existing imports
export type { UploadPhase, UploadResult };

interface UploadOptions {
  expirySeconds: number;
  burnAfterReading: boolean;
  maxViews: number | null;
  password: string | null;
  stripMetadata: boolean;
}

const DEFAULT_OPTIONS: UploadOptions = {
  expirySeconds: PHANTOM_CONFIG.DEFAULT_EXPIRY_MINUTES * 60,
  burnAfterReading: false,
  maxViews: null,
  password: null,
  stripMetadata: true,
};

export function useFileUpload(type: 'drop' | 'text' = 'drop') {
  const globalSession = useGlobalSession();
  const { addHistoryItem, markAsDestroyed } = useSenderHistory();
  const abortRef = useRef(false);

  const isDrop = type === 'drop';
  
  const phase = isDrop ? globalSession.dropPhase : globalSession.textPhase;
  const progress = isDrop ? globalSession.dropProgress : globalSession.textProgress;
  const error = isDrop ? globalSession.dropError : globalSession.textError;
  const result = isDrop ? globalSession.dropResult : globalSession.textResult;

  const setPhase = isDrop ? globalSession.setDropPhase : globalSession.setTextPhase;
  const setProgress = isDrop ? globalSession.setDropProgress : globalSession.setTextProgress;
  const setError = isDrop ? globalSession.setDropError : globalSession.setTextError;
  const setResult = isDrop ? globalSession.setDropResult : globalSession.setTextResult;
  const reset = isDrop ? globalSession.resetDrop : globalSession.resetText;

  const uploadFile = useCallback(async (
    fileOrFiles: File | File[],
    options: Partial<UploadOptions> = {}
  ): Promise<UploadResult | null> => {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    abortRef.current = false;
    reset();

    try {
      // Phase 1: Strip metadata & prepare data
      setPhase('stripping');
      setProgress(10);
      
      const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
      const filenames = files.map(f => f.name);
      
      const totalSize = files.reduce((acc, f) => acc + f.size, 0);
      if (totalSize > PHANTOM_CONFIG.MAX_FILE_SIZE) {
        throw new Error(`Total size too large. Maximum size is ${PHANTOM_CONFIG.MAX_FILE_SIZE_DISPLAY}.`);
      }

      const rawCode = generateSessionCode();
      const groupLookupCode = await hashString(rawCode);
      const expiresAt = expiryFromSeconds(opts.expirySeconds);

      setPhase('encrypting');
      setProgress(30);

      // We will upload multiple files concurrently
      const uploadPromises = files.map(async (f, index) => {
        const processed = opts.stripMetadata ? await stripFileMetadata(f) : f;
        const buffer = await processed.arrayBuffer();
        const fileSessionCode = files.length === 1 ? groupLookupCode : await hashString(`${rawCode}-${index}`);
        
        let encryptedData: ArrayBuffer;
        let ivBase64: string;
        let saltBase64: string | null = null;

        if (opts.password) {
          const combinedPassword = `${rawCode}-${opts.password}`;
          const encryptRes = await encryptWithPassword(buffer, combinedPassword);
          encryptedData = encryptRes.ciphertext;
          ivBase64 = encryptRes.iv;
          saltBase64 = encryptRes.salt;
        } else {
          const encryptRes = await encryptWithPassword(buffer, rawCode);
          encryptedData = encryptRes.ciphertext;
          ivBase64 = encryptRes.iv;
          saltBase64 = encryptRes.salt;
        }

        const storagePath = `${fileSessionCode}_${Date.now()}`;
        const { error: uploadError } = await uploadEncryptedFile(storagePath, encryptedData);
        if (uploadError) throw uploadError;

        const { error: dbError } = await createDropRecord({
          session_code: fileSessionCode,
          group_code: files.length > 1 ? groupLookupCode : null,
          storage_path: storagePath,
          encrypted_filename: processed.name,
          file_type: processed.type || 'application/octet-stream',
          file_size: processed.size,
          encryption_iv: ivBase64,
          encryption_salt: saltBase64,
          has_password: !!opts.password,
          burn_after_reading: opts.burnAfterReading,
          max_views: opts.maxViews,
          expires_at: expiresAt,
        });
        
        if (dbError) throw dbError;
      });

      setPhase('uploading');
      setProgress(60);

      // Execute all uploads concurrently
      await Promise.all(uploadPromises);

      setProgress(100);
      setPhase('done');

      const shareLink = generateShareLink('drop', rawCode, '');
      const uploadResult: UploadResult = { sessionCode: rawCode, shareLink, keyBase64: '', expiresAt, filenames };
      
      // Save to sender history
      addHistoryItem({
        id: rawCode,
        type: 'drop',
        rawCode,
        dbLookupCode: groupLookupCode,
        filenames,
        expiresAt,
        createdAt: new Date().toISOString(),
      });

      setResult(uploadResult);
      return uploadResult;

    } catch (err) {
      setPhase('error');
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      return null;
    }
  }, [setPhase, setProgress, setResult, setError, reset, addHistoryItem]);

  const uploadText = useCallback(async (
    text: string,
    contentType: string = 'text',
    options: Partial<UploadOptions> = {}
  ): Promise<UploadResult | null> => {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    reset();

    try {
      setPhase('encrypting');
      setProgress(30);

      const rawCode = generateSessionCode();
      const dbLookupCode = await hashString(rawCode);
      
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      
      let ciphertext: ArrayBuffer;
      let ivBase64: string;
      let saltBase64: string | null = null;
      
      if (opts.password) {
        const combinedPassword = `${rawCode}-${opts.password}`;
        const encryptRes = await encryptWithPassword(data.buffer, combinedPassword);
        ciphertext = encryptRes.ciphertext;
        ivBase64 = encryptRes.iv;
        saltBase64 = encryptRes.salt;
      } else {
        const encryptRes = await encryptWithPassword(data.buffer, rawCode);
        ciphertext = encryptRes.ciphertext;
        ivBase64 = encryptRes.iv;
        saltBase64 = encryptRes.salt;
      }

      setProgress(60);

      setPhase('uploading');
      const expiresAt = expiryFromSeconds(opts.expirySeconds);
      
      // Need to convert ArrayBuffer to Base64 to store in DB text column
      const { arrayBufferToBase64 } = await import('@/lib/crypto');
      const ciphertextBase64 = arrayBufferToBase64(ciphertext);

      const { error: dbError } = await createSecureText({
        session_code: dbLookupCode,
        encrypted_content: ciphertextBase64,
        content_type: contentType,
        encryption_iv: ivBase64,
        encryption_salt: saltBase64,
        has_password: !!opts.password,
        burn_after_reading: opts.burnAfterReading,
        max_views: opts.maxViews,
        expires_at: expiresAt,
      });
      if (dbError) throw dbError;

      setProgress(100);
      setPhase('done');

      const shareLink = generateShareLink('text', rawCode, '');
      const uploadResult: UploadResult = { sessionCode: rawCode, shareLink, keyBase64: '', expiresAt };
      
      // Save to sender history
      addHistoryItem({
        id: rawCode,
        type: 'text',
        rawCode,
        dbLookupCode,
        expiresAt,
        createdAt: new Date().toISOString(),
      });

      setResult(uploadResult);
      return uploadResult;

    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Failed to secure text');
      return null;
    }
  }, [setPhase, setProgress, setResult, setError, reset, addHistoryItem]);

  const abort = useCallback(() => {
    abortRef.current = true;
    reset();
  }, [reset]);

  const destructDrop = useCallback(async (sessionCode: string) => {
    const dbLookupCode = await hashString(sessionCode);
    await destroyDrop(dbLookupCode);
    markAsDestroyed(sessionCode);
    globalSession.resetDrop();
  }, [globalSession, markAsDestroyed]);

  const destructText = useCallback(async (sessionCode: string) => {
    const dbLookupCode = await hashString(sessionCode);
    await destroySecureText(dbLookupCode);
    markAsDestroyed(sessionCode);
    globalSession.resetText();
  }, [globalSession, markAsDestroyed]);

  return {
    uploadFile,
    uploadText,
    abort,
    reset,
    destructDrop,
    destructText,
    phase,
    progress,
    error,
    result,
    isProcessing: !['idle', 'done', 'error'].includes(phase),
  };
}
