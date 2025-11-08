import { loadDesign, loadMessages } from './actions';
import { EditorCanvas } from './_components/editor-canvas';
import { notFound } from 'next/navigation';

export default async function EditorPage({
  params,
}: {
  params: Promise<{ designId: string }>;
}) {
  const { designId } = await params;

  try {
    const design = await loadDesign(designId);
    const messages = await loadMessages(designId);

    return (
      <div className="h-screen w-screen overflow-hidden">
        <EditorCanvas
          designId={design.id}
          projectId={design.projectId}
          initialDoc={design.doc}
          initialMessages={messages}
          designName={design.name}
        />
      </div>
    );
  } catch (error) {
    console.error('Failed to load design:', error);
    notFound();
  }
}

