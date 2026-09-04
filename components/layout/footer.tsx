import { useTranslations } from 'next-intl';
import Link from 'next/link';

export function Footer() {
  const t = useTranslations('Footer');

  return (
    <footer className="border-t bg-gray-50/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-xl font-bold mb-4">Pet Boss Clinic</h3>
            <p className="text-gray-500 max-w-sm">
              {t('description')}
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Links</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/" className="hover:text-blue-600 transition-colors">Home</Link></li>
              <li><Link href="/services" className="hover:text-blue-600 transition-colors">Services</Link></li>
              <li><Link href="/about" className="hover:text-blue-600 transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-blue-600 transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>+1 (555) 123-4567</li>
              <li>info@petbossclinic.com</li>
              <li>123 Pet Street, Animal City, AC 12345</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t text-center text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} Pet Boss Clinic. {t('rights')}</p>
        </div>
      </div>
    </footer>
  );
}
