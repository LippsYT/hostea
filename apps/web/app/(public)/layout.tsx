import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { SupportWidget } from '@/components/support-widget';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>{children}</main>
      <Footer />
      <SupportWidget />
    </div>
  );
}
