import { createBrowserRouter, type RouteObject } from 'react-router'
import { AppShell } from '@/components/app-shell'
import { AuthGuard } from '@/components/auth-guard'
import Circle from '@/routes/circle'
import Home from '@/routes/home'
import Item from '@/routes/item'
import Join from '@/routes/join'
import Notifications from '@/routes/notifications'
import Privacy from '@/routes/privacy'
import SignIn from '@/routes/sign-in'
import Summary from '@/routes/summary'
import Terms from '@/routes/terms'
import Updates from '@/routes/updates'
import Week from '@/routes/week'
import Welcome from '@/routes/welcome'

// App routes (implementation plan §4.5). Bottom tabs: Home, This week,
// Updates, Summary. /circle opens from the member's initial and
// /notifications from the bell, both at the top of Home.
export const routes: RouteObject[] = [
  // Signed in and in a circle. Signed-out people go to /sign-in and come
  // back; people with no circle go to /welcome.
  {
    element: <AuthGuard requireCircle />,
    children: [
      {
        element: <AppShell tabs />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/week', element: <Week /> },
          { path: '/updates', element: <Updates /> },
          { path: '/summary', element: <Summary /> },
        ],
      },
      {
        element: <AppShell />,
        children: [
          { path: '/circle', element: <Circle /> },
          { path: '/notifications', element: <Notifications /> },
          { path: '/i/:itemId', element: <Item /> },
        ],
      },
    ],
  },
  // Signed in, circle or not.
  {
    element: <AuthGuard />,
    children: [{ path: '/welcome', element: <Welcome /> }],
  },
  // Signed out too. /join/:code shows the invite preview before sign-in and
  // handles signing in itself (wireframe 07).
  { path: '/join/:code', element: <Join /> },
  { path: '/sign-in', element: <SignIn /> },
  { path: '/privacy', element: <Privacy /> },
  { path: '/terms', element: <Terms /> },
]

export const router = createBrowserRouter(routes)
