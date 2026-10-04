import { createRoot } from "react-dom/client"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import "./index.css"
import App from "./App"
import FindStar from "./views/FindStar"
import FindGalaxy from "./views/FindGalaxy"
import Galaxy from "./views/Galaxy"
const root = createRoot(document.getElementById("root")!)
root.render(
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Routes>
            <Route element={<App />}>
                <Route path="/find-star/:profileId?" element={<FindStar />} />
                <Route
                    path="/find-galaxy/:profileId?"
                    element={<FindGalaxy />}
                />
                <Route path="/galaxy/:seed?/:index?" element={<Galaxy />} />
                <Route
                    path="*"
                    element={<Navigate to="/find-galaxy" replace />}
                />
            </Route>
        </Routes>
    </BrowserRouter>,
)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
