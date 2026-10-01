import { createBrowserRouter, type RouteObject } from 'react-router'
import Circle from '@/routes/circle'
import Home from '@/routes/home'
import Item from '@/routes/item'
import Join from '@/routes/join'
import Notifications from '@/routes/notifications'
import SignIn from '@/routes/sign-in'
import Summary from '@/routes/summary'
import Updates from '@/routes/updates'
import Week from '@/routes/week'
import Welcome from '@/routes/welcome'

// App routes (implementation plan §4.5). Bottom tabs: Home, This week,
// Updates, Summary. /circle opens from the member's initial and
// /notifications from the bell, both at the top of Home.
export const routes: RouteObject[] = [
  { path: '/', element: <Home /> },
  { path: '/week', element: <Week /> },
  { path: '/updates', element: <Updates /> },
  { path: '/summary', element: <Summary /> },
  { path: '/circle', element: <Circle /> },
  { path: '/notifications', element: <Notifications /> },
  { path: '/i/:itemId', element: <Item /> },
  { path: '/join/:code', element: <Join /> },
  { path: '/sign-in', element: <SignIn /> },
  { path: '/welcome', element: <Welcome /> },
]

export const router = createBrowserRouter(routes)
