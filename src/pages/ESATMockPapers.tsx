import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

const ESATMockPapers = () => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-50 to-blue-50 rounded-full mb-6">
            <Lock className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            ESAT Mock Papers
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Coming soon
          </p>
          <div className="mt-6 flex gap-4 justify-center">
            <Button variant="outline" asChild className="hover:scale-105 transition-transform duration-200">
              <Link to="/esat" className="no-underline">
                Back to ESAT Overview
              </Link>
            </Button>
            <Button variant="outline" asChild className="hover:scale-105 transition-transform duration-200">
              <a href="/pdfs/Oil.pdf" target="_blank" rel="noopener noreferrer" style={{textDecoration: "none"}}>
                Link to PDF
              </a>
            </Button>
            <Button variant="outline" asChild className="hover:scale-105 transition-transform duration-200">
              <Link to="/esat/past-papers" className="no-underline">
                Free Past Papers
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ESATMockPapers;
