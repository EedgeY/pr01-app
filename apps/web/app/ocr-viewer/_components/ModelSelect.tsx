import {
  availableModels,
  defaultModel,
} from '@workspace/ai/src/clients/models';

interface ModelSelectProps {
  value?: string;
  onChange: (model: string) => void;
  className?: string;
}

export const ModelSelect = ({
  value = defaultModel,
  onChange,
  className = '',
}: ModelSelectProps) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className='text-sm font-medium text-muted-foreground'>
        LLMモデル:
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className='border border-input rounded-md px-3 py-1.5 text-sm bg-background'
        title={availableModels.find((m) => m.id === value)?.description}
      >
        {availableModels.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
    </div>
  );
};
