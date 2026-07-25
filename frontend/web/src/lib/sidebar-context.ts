"use client"

import React from "react"

export const SidebarContext = React.createContext<{
  sidebarOpen: boolean
  toggleSidebar: () => void
}>({ sidebarOpen: false, toggleSidebar: () => {} })

export function useSidebar() {
  return React.useContext(SidebarContext)
}