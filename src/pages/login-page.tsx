import { Navigate } from 'react-router-dom'
import { WEBSITE_SEIZED_BANNER_SRC } from '@/assets/website-seized'
import { useAuth } from '@/context/auth-context'

export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth()

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <img
        src={WEBSITE_SEIZED_BANNER_SRC}
        alt="This website has been seized"
        width={1280}
        height={720}
        decoding="sync"
        fetchPriority="high"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-center [-webkit-user-drag:none]"
      />
    </div>
  )
}

// Archive of the original code before the seizure banner was added.

// import { Navigate } from 'react-router-dom'
// import { WEBSITE_SEIZED_BANNER_SRC } from '@/assets/website-seized'
// import { useAuth } from '@/context/auth-context'

// export function LoginPage() {
//   const { isAuthenticated, isLoading } = useAuth()

//   if (!isLoading && isAuthenticated) {
//     return <Navigate to="/" replace />
//   }

//   return (
//     <div className="fixed inset-0 overflow-hidden bg-black">
//       <img
//         src={WEBSITE_SEIZED_BANNER_SRC}
//         alt="This website has been seized"
//         width={1280}
//         height={720}
//         decoding="sync"
//         fetchPriority="high"
//         draggable={false}
//         className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-center [-webkit-user-drag:none]"
//       />
//     </div>
//   )
// }
