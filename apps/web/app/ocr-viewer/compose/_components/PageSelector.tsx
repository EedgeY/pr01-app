'use client';

type PageSelectorProps = {
  imageUrls: string[];
  selectedPage: number;
  onChange: (nextPage: number) => void;
};

export function PageSelector({
  imageUrls,
  selectedPage,
  onChange,
}: PageSelectorProps) {
  if (imageUrls.length === 0) {
    return null;
  }

  return (
    <div className='mb-4'>
      <div className='flex items-center gap-3'>
        <label className='text-sm font-medium'>ページ選択:</label>
        <select
          value={selectedPage}
          onChange={(event) => onChange(Number(event.target.value))}
          className='border border-input rounded-md px-3 py-1.5 text-sm bg-background'
        >
          {imageUrls.map((_, idx) => (
            <option key={idx} value={idx}>
              {idx + 1} / {imageUrls.length}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
