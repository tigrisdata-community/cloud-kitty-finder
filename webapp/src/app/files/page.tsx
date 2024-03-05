import { FilesResponse } from '@/app/api/files/route'
import { headers } from 'next/headers'
import styles from './page.module.css'
import Link from 'next/link'

export default async function Page () {
  const host = headers().get('host')
  const res = await fetch(`http://${host}/api/files/`, {
    method: 'GET',
    cache: 'no-store'
  })
  const files: FilesResponse = await res.json()
  // map the list of files to a link
  return (
    <body className={styles.body}>
    <div className={styles.list}>
      <h2>Available videos</h2>
      <ul>
        {files.map((f, index) => (
          <li key={f.key}>
            <span><Link href={`/files/${f.urlSlug}`}>{index + 1}. {f.displayName}</Link></span>
          </li>
        ))}
      </ul>
    </div>
    </body>
  )
}
