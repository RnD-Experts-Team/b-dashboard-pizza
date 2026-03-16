import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Pizza Dashboard Docs',
  description: 'Developer documentation for the B-Dashboard Pizza project',
  base: '/docs/',

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
    ],

    sidebar: [
      {
        text: 'Pages Explanation',
        items: [
          { text: 'DSPR Dashboard',                   link: '/dspr-dashboard' },
          { text: 'Stores & User Assignment',         link: '/stores-user-assignment' },
          { text: 'Roles, Users & Permissions',       link: '/roles-users-permissions' },
          { text: 'QA, Entities & Camera',            link: '/qa-entities-camera' },
          { text: 'Keys, Due-Keys & Export/Import',   link: '/keys-duekeys-exportimport' },
          { text: 'Sensors & Maintenance',            link: '/sensors-maintenance' },
          { text: 'Auth, Hierarchy & Service Clients', link: '/auth-hierarchy-serviceclients' },
        ],
      },
    ],

    socialLinks: [],
    search: { provider: 'local' },
  },
})
