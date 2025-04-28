import { Toaster } from '@/components/ui/toaster';
import { trpcReact } from '@/trpc';
import TrpcWrapper from '@/trpcWrapper';
import { AppHeader } from './components/AppHeader';
import { ErrorBoundary } from './components/ErrorBoundary';
import PhotoGallery from './components/PhotoGallery';
import { ThemeProvider } from './contexts/ThemeContext';
import { useToast } from './hooks/use-toast';

function AppContent() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader />
      <ToasterWrapper />
      <Contents />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <TrpcWrapper>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </TrpcWrapper>
    </ErrorBoundary>
  );
}

const ToasterWrapper = () => {
  const { toast } = useToast();
  trpcReact.subscribeToast.useSubscription(undefined, {
    onData: (content: unknown) => {
      if (typeof content === 'string') {
        console.log('toast', content);
        toast({
          description: content,
        });
        return;
      }
      console.log('toast', JSON.stringify(content));
      toast({
        description: JSON.stringify(content),
      });
    },
  });
  return (
    <>
      <Toaster />
    </>
  );
};

const Contents = () => {
  return <PhotoGallery />;
};

export default App;
