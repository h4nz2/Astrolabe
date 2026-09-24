import * as React from "react"

// No SSR any more: this is plain useLayoutEffect, kept under its old name for the existing call sites.
const useIsomorphicLayoutEffect = React.useLayoutEffect

export default useIsomorphicLayoutEffect
