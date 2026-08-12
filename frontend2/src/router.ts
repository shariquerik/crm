import { createRouter, createWebHistory } from 'vue-router'

import { resolveRouteDoctype } from '@/data/doctypes'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/pages/Home.vue'),
  },
  {
    path: '/page-scripts/:doctype',
    name: 'PageScripts',
    component: () => import('@/pages/PageScripts.vue'),
  },
  {
    path: '/:doctype',
    name: 'List',
    component: () => import('@/pages/List.vue'),
  },
  {
    path: '/:doctype/view/:viewName',
    name: 'SavedView',
    component: () => import('@/pages/List.vue'),
  },
  {
    path: '/:doctype/:id',
    name: 'Record',
    component: () => import('@/pages/Record.vue'),
  },
]

const router = createRouter({
  history: createWebHistory('/crm2'),
  routes,
})

// Pages read their doctype at setup, so a slug ("crm-lead") or the wrong case has to
// become the canonical name before one mounts.
router.beforeResolve(async (to) => {
  const segment = to.params.doctype
  if (typeof segment !== 'string' || !segment) return true

  const doctype = await resolveRouteDoctype(segment)
  if (!doctype || doctype === segment) return true

  return {
    name: to.name,
    params: { ...to.params, doctype },
    query: to.query,
    hash: to.hash,
    replace: true,
  }
})

export default router
