import { Mail, Linkedin, Instagram } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-muted/50 border-t border-border mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* About Section */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">About Us</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/about" className="text-[hsl(var(--footer-blue))] hover:text-[hsl(var(--footer-blue-hover))] transition-colors no-underline">
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Services Section */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Services</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/team" className="text-[hsl(var(--footer-blue))] hover:text-[hsl(var(--footer-blue-hover))] transition-colors no-underline">
                  Our Tutors
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-[hsl(var(--footer-blue))] hover:text-[hsl(var(--footer-blue-hover))] transition-colors no-underline">
                  Become a Tutor
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links Section */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Content</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/tmua" className="text-[hsl(var(--footer-blue))] hover:text-[hsl(var(--footer-blue-hover))] transition-colors no-underline">
                  TMUA
                </Link>
              </li>
              <li>
                <Link to="/mat" className="text-[hsl(var(--footer-blue))] hover:text-[hsl(var(--footer-blue-hover))] transition-colors no-underline">
                  MAT
                </Link>
              </li>
              <li>
                <Link to="/esat" className="text-[hsl(var(--footer-blue))] hover:text-[hsl(var(--footer-blue-hover))] transition-colors no-underline">
                  ESAT
                </Link>
              </li>
              <li>
                <Link to="/interview-prep" className="text-[hsl(var(--footer-blue))] hover:text-[hsl(var(--footer-blue-hover))] transition-colors no-underline">
                  Interview Prep
                </Link>
              </li>
            </ul>
          </div>

          {/* Past Papers Section */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Past Papers</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/tmua-past-papers" className="text-[hsl(var(--footer-blue))] hover:text-[hsl(var(--footer-blue-hover))] transition-colors no-underline">
                  TMUA Past Papers
                </Link>
              </li>
              <li>
                <Link to="/mat-past-papers" className="text-[hsl(var(--footer-blue))] hover:text-[hsl(var(--footer-blue-hover))] transition-colors no-underline">
                  MAT Past Papers
                </Link>
              </li>
              <li>
                <Link to="/esat-past-papers" className="text-[hsl(var(--footer-blue))] hover:text-[hsl(var(--footer-blue-hover))] transition-colors no-underline">
                  ESAT Past Papers
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Contact Section - Bottom Bar */}
        <div className="border-t border-border mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <span className="text-muted-foreground text-sm">Contact Us:</span>
            <a 
              href="mailto:oxbridgeandimperialprep@gmail.com"
              className="text-[hsl(var(--footer-blue))] hover:text-[hsl(var(--footer-blue-hover))] transition-colors text-sm no-underline"
            >
              oxbridgeandimperialprep@gmail.com
            </a>
          </div>
          <div className="flex items-center gap-4 mt-4 sm:mt-0">
            <span className="text-muted-foreground text-sm">Follow Us</span>
            <div className="flex gap-3">
              <a 
                href="https://www.linkedin.com/company/oxbridge-and-imperial-prep-hub/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a 
                href="https://www.instagram.com/oxbridge_and_imperial_prep/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
