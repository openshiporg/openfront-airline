import { staffTitle, titleFromSlug } from '@/features/dashboard/lib/staffTitle'
import { getListByPath } from '@/features/dashboard/actions/getListByPath'
import { ListPage } from "@/features/dashboard/screens/ListPage";

export default ListPage

export async function generateMetadata({ params }: { params: Promise<{ listKey: string }> }) {
  const { listKey } = await params
  const list = await getListByPath(listKey).catch(() => undefined)
  return staffTitle(list ? list.label : titleFromSlug(listKey))
}
