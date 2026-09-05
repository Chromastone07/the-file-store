# The File Store (The Vault)

A modern, secure, and aesthetically pleasing file management system designed for temporary and permanent storage. Built with a focus on user experience and "Claymorphism" design principles, **The File Store** allows users to upload, manage, and preview files with an added layer of privacy through self-destructing links.

##  Key Features

  * ** Unique UI/UX:** Features a custom **Claymorphism** design for a soft, tactile, and modern visual experience.
  * ** Self-Destruct Timer:** Set expiration dates on uploaded files. Once the timer hits zero, the file is automatically purged from the vault.
  * ** Rich File Previews:** Built-in support for viewing:
      * **Images & Videos:** Direct high-quality playback and viewing.
      * **Documents:** Integration with Google Viewer for PDFs and Office documents.
  * ** Admin Control Panel:** A dedicated dashboard to manage global permissions, including toggles for public uploads, viewing, and deletions.
  * ** Custom Identity:** Users can set and display custom profile names for their shared repositories.
  * ** Metadata Tracking:** Real-time tracking of file sizes and remaining time-to-live (TTL).

##  Tech Stack

  * **Framework:** [Next.js](https://nextjs.org/) (App Router)
  * **Database & Storage:** [Supabase](https://supabase.com/) (PostgreSQL + S3 Storage)
  * **Styling:** Tailwind CSS (Customized for Claymorphism effects)
  * **Deployment:** Vercel

##  Installation & Setup

To run this project locally, follow these steps:

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/Chromastone07/the-file-store.git
    cd the-file-store
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Environment Variables:**
    Create a `.env.local` file in the root directory and add your Supabase credentials:

    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run the development server:**

    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) to see the result.

##  Project Structure

```text
├── components/        # Reusable UI components (Claymorphism cards, buttons)
├── app/               # Next.js App Router (Pages and API routes)
├── hooks/             # Custom React hooks for file handling
├── lib/               # Supabase client and utility functions
└── public/            # Static assets and icons
```

##  Security Model

The project utilizes a custom security model where the admin can restrict access globally. Every file upload is validated against the active permissions in the admin panel, ensuring that public access can be revoked instantly if needed.

##  Contributing

This project is a personal exploration of modern UI and secure storage. If you'd like to contribute, feel free to fork the repo and submit a pull request\!

-----

*Created with ❤️ by Suraj (Chromastone07)*
