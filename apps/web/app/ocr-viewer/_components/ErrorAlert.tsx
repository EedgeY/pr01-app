interface ErrorAlertProps {
  error: string | null;
}

export const ErrorAlert = ({ error }: ErrorAlertProps) => {
  if (!error) return null;

  return (
    <div className='mb-6 p-4 bg-destructive/10 border-l-4 border-destructive rounded-lg'>
      <div className='flex items-start'>
        <svg
          className='w-5 h-5 text-destructive mt-0.5 mr-3'
          fill='currentColor'
          viewBox='0 0 20 20'
        >
          <path
            fillRule='evenodd'
            d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
            clipRule='evenodd'
          />
        </svg>
        <div>
          <h3 className='text-sm font-medium text-destructive'>Error</h3>
          <p className='text-sm text-destructive/90 mt-1'>{error}</p>
        </div>
      </div>
    </div>
  );
};
