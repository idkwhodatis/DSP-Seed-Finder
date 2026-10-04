// Keep Three and the rendering code out of the initial application bundle.
export const loadGalaxyAnimation = () => import("./GalaxyAnimation.runtime")
