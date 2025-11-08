import { redirect } from 'next/navigation';
import { createProjectAndDesign } from '../editor/[designId]/actions';

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const params = await searchParams;
  const template = (params.template || 'welcome') as 'welcome' | 'blank';

  // 新しいプロジェクトとデザインを作成
  const { designId } = await createProjectAndDesign({
    template,
    projectName: 'New Project',
    designName: 'Untitled Design',
  });

  // エディタページにリダイレクト
  redirect(`/editor/${designId}`);
}

