import { staffTitle, titleFromSlug } from '@/features/dashboard/lib/staffTitle'
import { getListByPath } from '@/features/dashboard/actions/getListByPath'
import { ItemPage } from "@/features/dashboard/screens/ItemPage";

export default ItemPage;

export async function generateMetadata({ params }: { params: Promise<{ listKey: string }> }) {
  const { listKey } = await params
  const list = await getListByPath(listKey).catch(() => undefined)
  return staffTitle(list ? list.singular : titleFromSlug(listKey))
}
