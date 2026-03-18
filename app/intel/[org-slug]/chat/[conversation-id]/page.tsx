import { redirect } from 'next/navigation';
import { verifyOrgAccess } from '@/lib/intel/middleware';
import ChatInterface from '@/components/intel/ChatInterface';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ 'org-slug': string; 'conversation-id': string }>;
}) {
  const { 'org-slug': orgSlug, 'conversation-id': conversationId } = await params;
  const access = await verifyOrgAccess(orgSlug);
  if (!access) redirect('/intel/login');

  const { org, member, user } = access;

  if (member.role === 'viewer') {
    redirect(`/intel/${orgSlug}`);
  }

  return (
    <ChatInterface
      orgId={org.id}
      orgSlug={orgSlug}
      orgName={org.name}
      userId={user.id}
      userRole={member.role}
      userName={member.display_name}
      initialConversationId={conversationId}
    />
  );
}
