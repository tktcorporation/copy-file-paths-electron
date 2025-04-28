import { trpcReact } from '@/trpc';
import { memo } from 'react';
import { useToast } from '../hooks/use-toast';
import { useI18n } from '../i18n/store';

const PhotoGallery = memo(() => {
  return <div className="flex flex-col h-full">Hello</div>;
});

PhotoGallery.displayName = 'PhotoGallery';

export default PhotoGallery;
