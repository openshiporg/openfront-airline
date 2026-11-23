import { staffTitle, titleFromSlug } from '@/features/dashboard/lib/staffTitle'
import { getListByPath } from '@/features/dashboard/actions/getListByPath'
import { CreatePage } from "@/features/dashboard/screens/CreatePage";

export default CreatePage;

export async function generateMetadata({ params }: { params: Promise<{ listKey: string }> }) {
  const { listKey } = await params
  const list = await getListByPath(listKey).catch(() => undefined)
  return staffTitle(list ? `New ${list.singular.toLowerCase()}` : titleFromSlug(listKey))
}
