'use client';

import { Toaster } from 'react-hot-toast';

export function RootToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#1e293b',
          color: '#f8fafc',
          border: '1px solid #334155',
        },
      }}
    />
  );
}
