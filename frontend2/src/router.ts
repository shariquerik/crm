import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/pages/Home.vue'),
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
    name: 'Detail',
    component: () => import('@/pages/Detail.vue'),
  },
]

export default createRouter({
  history: createWebHistory('/crm2'),
  routes,
})
