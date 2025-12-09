import "./globals.css";
import { AuthProvider } from "./context/AuthContext";

export const metadata = {
  title: "Lecture Transcription MVP",
  description: "AI-powered lecture transcription and study assistant",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}