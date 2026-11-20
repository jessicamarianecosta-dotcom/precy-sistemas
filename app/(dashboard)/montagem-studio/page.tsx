import { Header } from '@/components/layout/Header'
import { MontagemStudio } from '@/components/montagem/MontagemStudio'

export default function MontagemStudioPage() {
  return (
    <>
      <Header title="Montagem" subtitle="Monte e aproveite artes para impressão em folhas ou bobinas" />
      <div className="p-4 lg:p-6">
        <MontagemStudio variant="internal" />
      </div>
    </>
  )
}
