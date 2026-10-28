"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import jsQR from "jsqr";
import { 
  X, 
  Camera, 
  FlipHorizontal, 
  Zap, 
  ZapOff, 
  Upload, 
  AlertCircle,
  CheckCircle2,
  ScanLine,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan?: (data: string) => void;
  title?: string;
}

export default function QRScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "Scan QR Code",
}: QRScannerModalProps) {
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const hasHandledRef = useRef<boolean>(false);
  const barcodeDetectorRef = useRef<unknown>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanSuccessData, setScanSuccessData] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);

  // Reset handled state when modal opens
  useEffect(() => {
    if (isOpen) {
      hasHandledRef.current = false;
      setScanSuccessData(null);
    }
  }, [isOpen]);

  // Play subtle feedback beep using Web Audio API
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // AudioContext not allowed or not supported
    }
  };

  // Process and route scanned code/URL
  const handleScannedResult = useCallback((scannedText: string) => {
    if (!scannedText || hasHandledRef.current) return;
    hasHandledRef.current = true;
    const clean = scannedText.trim();

    // Trigger haptic & audio feedback
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([40, 60, 40]);
      } catch {}
    }
    playBeep();

    setScanSuccessData(clean);

    setTimeout(async () => {
      onClose();

      if (onScan) {
        onScan(clean);
        return;
      }

      // Default smart routing
      try {
        // Case 1: Full URL scanned (e.g. https://.../d/ABCDEF12#key, /t/..., /chat?join=...)
        if (clean.startsWith("http://") || clean.startsWith("https://")) {
          const url = new URL(clean);
          if (
            url.pathname.startsWith("/d/") || 
            url.pathname.startsWith("/t/") || 
            url.pathname.startsWith("/chat")
          ) {
            // Keep on current origin, preserve pathname, search query, and hash fragment key!
            const target = `${window.location.origin}${url.pathname}${url.search}${url.hash}`;
            window.location.href = target;
            return;
          }

          // External URL
          window.location.href = clean;
          return;
        }

        // Case 2: Relative path scanned (/d/..., /t/..., /chat...)
        if (clean.startsWith("/d/") || clean.startsWith("/t/") || clean.startsWith("/chat")) {
          window.location.href = clean;
          return;
        }

        // Case 3: Code only (alphanumeric access code or room code)
        const codeOnly = clean.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        if (codeOnly.length >= 5 && codeOnly.length <= 12) {
          toast.loading("Fetching share details...", { id: "qr-fetch", duration: 4000 });
          try {
            const { getClipboardSession, getSecureTextByCode } = await import("@/lib/supabase");

            // 1. Check Chat Room
            const { data: chatData } = await getClipboardSession(codeOnly);
            if (chatData && chatData.session_code) {
              toast.dismiss("qr-fetch");
              router.push(`/chat?join=${codeOnly}`);
              return;
            }

            // 2. Check Secure Text
            let dbLookupCode = codeOnly;
            if (codeOnly.length !== 6) {
              const { hashString } = await import("@/lib/crypto");
              dbLookupCode = await hashString(codeOnly);
            }
            const { data: textData } = await getSecureTextByCode(dbLookupCode);
            if (textData) {
              toast.dismiss("qr-fetch");
              window.location.href = `/t/${codeOnly}`;
              return;
            }

            // 3. Fallback to File Drop
            toast.dismiss("qr-fetch");
            window.location.href = `/d/${codeOnly}`;
            return;
          } catch {
            toast.dismiss("qr-fetch");
            window.location.href = `/d/${codeOnly}`;
            return;
          }
        }

        toast.info(`Scanned: ${clean}`);
      } catch (err) {
        console.warn("QR routing error", err);
        toast.error("Failed to route scanned QR code");
      }
    }, 350);
  }, [onClose, onScan, router]);

  // Stop camera tracks and cleanup animation
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    setIsTorchOn(false);
  }, []);

  // Start camera stream
  const startCamera = useCallback(async (mode: "environment" | "user") => {
    stopCamera();
    setErrorMessage(null);
    setScanSuccessData(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setHasPermission(false);
      setErrorMessage("Camera access is not supported by this browser.");
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setHasPermission(true);

      // Check flashlight/torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = typeof videoTrack.getCapabilities === "function" 
          ? (videoTrack.getCapabilities() as unknown as { torch?: boolean }) 
          : {};
        setHasTorch(Boolean(capabilities?.torch));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setIsScanning(true);
      }
    } catch (err: unknown) {
      console.warn("Camera init error:", err);
      setHasPermission(false);
      const isDenied = err instanceof Error && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      if (isDenied) {
        setErrorMessage("Camera permission denied. You can still scan by uploading an image below.");
      } else {
        setErrorMessage("Unable to access camera. Please check your camera settings or upload an image.");
      }
    }
  }, [stopCamera]);

  // Frame processing loop with Native BarcodeDetector + jsQR fallback
  useEffect(() => {
    if (!isScanning || !isOpen) return;

    let isActive = true;

    const scanFrame = async () => {
      if (!isActive || hasHandledRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        // 1. Try Native Hardware BarcodeDetector if supported (instant, accurate, supports inverted codes)
        if (typeof window !== "undefined" && "BarcodeDetector" in window) {
          try {
            if (!barcodeDetectorRef.current) {
              // @ts-expect-error - Native BarcodeDetector API
              barcodeDetectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
            }
            // @ts-expect-error - Native BarcodeDetector API
            const barcodes = await barcodeDetectorRef.current.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              handleScannedResult(barcodes[0].rawValue);
              return;
            }
          } catch {
            // Fall through to jsQR
          }
        }

        // 2. jsQR Canvas fallback with inversionAttempts: "attemptBoth"
        if (canvas) {
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            // Downscale high-resolution frames to max 640px to keep CPU/memory fast at 60fps
            const maxDim = 640;
            let w = video.videoWidth;
            let h = video.videoHeight;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }

            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(video, 0, 0, w, h);

            const imageData = ctx.getImageData(0, 0, w, h);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "attemptBoth", // CRITICAL FOR INVERTED PHANTOM QR CODES
            });

            if (code && code.data) {
              handleScannedResult(code.data);
              return;
            }
          }
        }
      }

      if (isActive && !hasHandledRef.current) {
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      isActive = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isScanning, isOpen, handleScannedResult]);

  // Handle open/close lifecycle
  useEffect(() => {
    let unmounted = false;
    if (isOpen) {
      queueMicrotask(() => {
        if (!unmounted) {
          startCamera(facingMode);
        }
      });
    } else {
      queueMicrotask(() => {
        if (!unmounted) {
          stopCamera();
        }
      });
    }
    return () => {
      unmounted = true;
      stopCamera();
    };
  }, [isOpen, facingMode, startCamera, stopCamera]);

  // Toggle Torch / Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      const newTorch = !isTorchOn;
      // @ts-expect-error - Torch constraint is supported in modern mobile Chrome/Android
      await track.applyConstraints({ advanced: [{ torch: newTorch }] });
      setIsTorchOn(newTorch);
    } catch (e) {
      console.warn("Torch toggle error:", e);
    }
  };

  // Flip Camera Front/Back
  const toggleFacingMode = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
  };

  // Handle Image Upload Fallback
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        // Try native BarcodeDetector on image
        if (typeof window !== "undefined" && "BarcodeDetector" in window) {
          try {
            if (!barcodeDetectorRef.current) {
              // @ts-expect-error - Native BarcodeDetector API
              barcodeDetectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
            }
            // @ts-expect-error - Native BarcodeDetector API
            const barcodes = await barcodeDetectorRef.current.detect(img);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              setIsProcessingImage(false);
              handleScannedResult(barcodes[0].rawValue);
              return;
            }
          } catch {
            // Fall back to jsQR
          }
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = img.width;
        canvas.height = img.height;

        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
          });

          setIsProcessingImage(false);
          if (code && code.data) {
            handleScannedResult(code.data);
          } else {
            toast.error("No valid QR code found in this image. Try another.");
          }
        } else {
          setIsProcessingImage(false);
          toast.error("Could not process image.");
        }
      };
      img.onerror = () => {
        setIsProcessingImage(false);
        toast.error("Failed to load image file.");
      };
      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      setIsProcessingImage(false);
      toast.error("Failed to read image file.");
    };

    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative w-full max-w-sm sm:max-w-md bg-[var(--wisp-surface)] border border-[var(--wisp-border)] rounded-3xl overflow-hidden shadow-2xl flex flex-col z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--wisp-border)] bg-[var(--wisp-surface)]/90 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <ScanLine className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--wisp-text)]">{title}</h3>
                  <p className="text-[10px] text-[var(--wisp-muted)]">Point camera at a Phantom QR code</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--wisp-elevated)] hover:bg-rose-500/20 text-[var(--wisp-muted)] hover:text-rose-400 border border-[var(--wisp-border)] transition-all cursor-pointer"
                aria-label="Close scanner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Viewfinder Area */}
            <div className="relative aspect-square w-full bg-black flex items-center justify-center overflow-hidden">
              {/* Hidden Canvas for Frame Analysis */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Video Feed */}
              <video
                ref={videoRef}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  isScanning ? "opacity-100" : "opacity-0"
                }`}
              />

              {/* Viewfinder Overlay with Cyberpunk Laser */}
              {isScanning && !scanSuccessData && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* Outer Dim Mask */}
                  <div className="relative w-64 h-64 sm:w-72 sm:h-72">
                    {/* Glowing Corner Brackets */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-400 rounded-tl-xl shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-400 rounded-tr-xl shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-400 rounded-bl-xl shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-400 rounded-br-xl shadow-[0_0_15px_rgba(99,102,241,0.8)]" />

                    {/* Sweeping Laser Line */}
                    <motion.div
                      animate={{
                        top: ["5%", "95%", "5%"],
                      }}
                      transition={{
                        duration: 2.2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-indigo-500 via-cyan-300 to-indigo-500 shadow-[0_0_15px_rgba(34,211,238,0.9)]"
                    />

                    {/* Subtle Crosshairs */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-30">
                      <div className="w-6 h-0.5 bg-indigo-400" />
                      <div className="h-6 w-0.5 bg-indigo-400 absolute" />
                    </div>
                  </div>
                </div>
              )}

              {/* Success Flash Overlay */}
              {scanSuccessData && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-bold">QR Code Verified!</h4>
                  <p className="text-xs text-emerald-200 mt-1 max-w-[200px] truncate font-mono">
                    {scanSuccessData}
                  </p>
                </motion.div>
              )}

              {/* Error or Permission Denied State */}
              {errorMessage && (
                <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                    <AlertCircle className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-[var(--wisp-text)]">Camera Unavailable</h4>
                  <p className="text-xs text-[var(--wisp-muted)] mt-1.5 mb-5 max-w-xs leading-relaxed">
                    {errorMessage}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => startCamera(facingMode)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] hover:bg-[var(--wisp-surface)] text-[var(--wisp-text)] flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Camera</span>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Image</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Initial Permission Loading */}
              {hasPermission === null && !errorMessage && (
                <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center p-6 text-center text-[var(--wisp-muted)]">
                  <Camera className="w-8 h-8 animate-pulse text-indigo-400 mb-2" />
                  <span className="text-xs">Requesting camera access...</span>
                </div>
              )}
            </div>

            {/* Bottom Controls Bar */}
            <div className="px-4 py-3 bg-[var(--wisp-surface)] border-t border-[var(--wisp-border)] flex items-center justify-between text-xs text-[var(--wisp-text)]">
              {/* Left: Camera Switch */}
              <button
                onClick={toggleFacingMode}
                disabled={!isScanning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--wisp-elevated)] hover:bg-[var(--wisp-border)] border border-[var(--wisp-border)] disabled:opacity-40 transition-colors cursor-pointer"
                title="Flip Camera"
              >
                <FlipHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] font-medium hidden sm:inline">Flip</span>
              </button>

              {/* Center: Torch Toggle (if supported) */}
              {hasTorch && (
                <button
                  onClick={toggleTorch}
                  disabled={!isScanning}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    isTorchOn
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                      : "bg-[var(--wisp-elevated)] border-[var(--wisp-border)] text-[var(--wisp-text)] hover:bg-[var(--wisp-border)]"
                  }`}
                  title={isTorchOn ? "Turn Flashlight Off" : "Turn Flashlight On"}
                >
                  {isTorchOn ? <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> : <ZapOff className="w-3.5 h-3.5" />}
                  <span className="text-[11px] font-medium">{isTorchOn ? "Flash On" : "Flash"}</span>
                </button>
              )}

              {/* Right: Upload from Gallery Fallback */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingImage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--wisp-elevated)] hover:bg-[var(--wisp-border)] border border-[var(--wisp-border)] text-[var(--wisp-text)] transition-colors cursor-pointer"
                title="Upload image with QR code"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] font-medium">
                  {isProcessingImage ? "Reading..." : "Upload Photo"}
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
