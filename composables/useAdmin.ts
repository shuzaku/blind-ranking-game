const isAdmin = ref(false)

export function useAdmin() {
  if (process.client && !isAdmin.value) {
    isAdmin.value = sessionStorage.getItem('adminAuth') === 'true'
  }

  function setAdmin(val: boolean) {
    isAdmin.value = val
    if (process.client) {
      if (val) sessionStorage.setItem('adminAuth', 'true')
      else sessionStorage.removeItem('adminAuth')
    }
  }

  function adminPin(): string {
    return process.client ? (sessionStorage.getItem('adminPin') ?? '') : ''
  }

  function adminHeaders(): Record<string, string> {
    const pin = adminPin()
    return pin ? { 'x-admin-pin': pin } : {}
  }

  return { isAdmin: readonly(isAdmin), setAdmin, adminHeaders }
}
