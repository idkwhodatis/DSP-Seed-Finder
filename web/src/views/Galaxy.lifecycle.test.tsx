import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
    MemoryRouter,
    Routes,
    Route,
    useNavigate,
    type NavigateFunction,
} from "react-router-dom"
import { setupI18n } from "@lingui/core"
import { I18nProvider } from "@lingui/react"
import Galaxy, { parseGameParameters } from "./Galaxy"
import { generateGalaxy, searchStar } from "../worldgen"
import { getDefaultParams, getSearch } from "../util"
import { RuleType } from "../enums"

vi.mock("../worldgen", () => ({ generateGalaxy: vi.fn(), searchStar: vi.fn() }))
vi.mock("../partials/GalaxyOverview", () => ({
    default: ({ galaxy }: { galaxy: Galaxy }) => (
        <div data-testid="overview">{galaxy.seed}</div>
    ),
}))
vi.mock("../partials/StarView", () => ({
    default: ({ star }: { star: Star }) => (
        <div data-testid="star-view">{star.name}</div>
    ),
}))
vi.mock("../partials/RuleEditor", () => ({
    default: ({ onChange }: { onChange: (rules: SimpleRule[][]) => void }) => (
        <button onClick={() => onChange([[{ type: RuleType.Birth }]])}>
            Edit rules
        </button>
    ),
}))
vi.mock("../partials/ExportModal", () => ({
    default: ({
        visible,
        onClose,
    }: {
        visible: boolean
        onClose: () => void
    }) =>
        visible ? (
            <div role="dialog">
                <button onClick={onClose}>Close export</button>
            </div>
        ) : null,
}))

afterEach(cleanup)
beforeEach(() => {
    vi.mocked(generateGalaxy).mockReset()
    vi.mocked(searchStar).mockReset()
    localStorage.setItem(
        "dsp-seed-finder-star-search-rules",
        JSON.stringify([[{ type: RuleType.Birth }]]),
    )
})

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (error: Error) => void
    const promise = new Promise<T>((yes, no) => {
        resolve = yes
        reject = no
    })
    return { promise, resolve, reject }
}

function galaxy(seed: number): Galaxy {
    return {
        seed,
        stars: [
            { index: 0, name: "Alpha" },
            { index: 1, name: "Beta" },
        ] as Star[],
    }
}

function route(path: string) {
    let navigate!: NavigateFunction
    function Content() {
        navigate = useNavigate()
        return (
            <Routes>
                <Route path="/galaxy/:seed?/:index?" element={<Galaxy />} />
                <Route path="/away" element={<div>Away</div>} />
            </Routes>
        )
    }
    const view = render(
        <I18nProvider i18n={setupI18n({ locale: "en", messages: { en: {} } })}>
            <MemoryRouter initialEntries={[path]}>
                <Content />
            </MemoryRouter>
        </I18nProvider>,
    )
    return {
        ...view,
        router: { navigate: (destination: string) => navigate(destination) },
    }
}

function searchPanel() {
    return within(
        screen.getByText(/Find stars matching the following criteria/)
            .parentElement!,
    )
}

describe("galaxy route and generation lifecycle", () => {
    it("accepts seed zero and preserves game parameters in star links", async () => {
        vi.mocked(generateGalaxy).mockResolvedValue(galaxy(0))
        const query =
            "?count=32&multiplier=0.5&hiveInitialColonize=0.25&hiveMaxDensity=1.5&useActualVeins=true"
        route(`/galaxy/0${query}`)
        expect(await screen.findByTestId("overview")).toHaveTextContent("0")
        const params = parseGameParameters(new URLSearchParams(query))
        expect(params).toMatchObject({
            starCount: 32,
            resourceMultiplier: 0.5,
            hiveInitialColonize: 0.25,
            hiveMaxDensity: 1.5,
            useActualVeins: true,
        })
        expect(generateGalaxy).toHaveBeenCalledWith(false, 0, params)
        expect(screen.getByRole("link", { name: "Alpha #1" })).toHaveAttribute(
            "href",
            `/galaxy/0/0${getSearch(params)}`,
        )
    })

    it.each(["abc", "-1", "1.5", "100000000", "1e2"])(
        "rejects invalid seed %s without starting generation",
        (seed) => {
            route(`/galaxy/${seed}`)
            expect(screen.getByRole("alert")).toHaveTextContent("Invalid seed.")
            expect(generateGalaxy).not.toHaveBeenCalled()
        },
    )

    it.each(["abc", "-1", "1.5"])(
        "rejects malformed star index %s",
        (index) => {
            route(`/galaxy/1/${index}`)
            expect(screen.getByRole("alert")).toHaveTextContent(
                "Invalid star index.",
            )
            expect(generateGalaxy).not.toHaveBeenCalled()
        },
    )

    it("handles an out-of-range star index without dereferencing an absent star", async () => {
        vi.mocked(generateGalaxy).mockResolvedValue(galaxy(1))
        route("/galaxy/1/99")
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Invalid star index.",
        )
        expect(screen.queryByTestId("star-view")).toBeNull()
    })

    it.each(["/galaxy/2", "/galaxy/1?count=32"])(
        "discards an older galaxy after navigating to %s",
        async (destination) => {
            const old = deferred<Galaxy>(),
                current = deferred<Galaxy>()
            vi.mocked(generateGalaxy)
                .mockReturnValueOnce(old.promise)
                .mockReturnValueOnce(current.promise)
            const { router } = route("/galaxy/1")
            await act(async () => {
                await router.navigate(destination)
            })
            expect(generateGalaxy).toHaveBeenCalledTimes(2)
            await act(async () => {
                current.resolve(galaxy(2))
            })
            expect(screen.getByTestId("overview")).toHaveTextContent("2")
            await act(async () => {
                old.resolve(galaxy(1))
            })
            expect(screen.getByTestId("overview")).toHaveTextContent("2")
        },
    )

    it("allows retry after a failed generation", async () => {
        vi.mocked(generateGalaxy)
            .mockRejectedValueOnce(new Error("worker failure"))
            .mockResolvedValueOnce(galaxy(1))
        route("/galaxy/1")
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Unable to generate this galaxy.",
        )
        fireEvent.click(screen.getByRole("button", { name: "Retry" }))
        expect(await screen.findByTestId("overview")).toHaveTextContent("1")
        expect(generateGalaxy).toHaveBeenCalledTimes(2)
    })

    it("ignores generation completion after the viewer unmounts", async () => {
        const pending = deferred<Galaxy>()
        vi.mocked(generateGalaxy).mockReturnValue(pending.promise)
        const { router } = route("/galaxy/1")
        await act(async () => {
            await router.navigate("/away")
        })
        await act(async () => {
            pending.resolve(galaxy(1))
        })
        expect(screen.getByText("Away")).toBeTruthy()
        expect(screen.queryByTestId("overview")).toBeNull()
    })

    it("falls back safely for malformed query values", () => {
        expect(
            parseGameParameters(
                new URLSearchParams(
                    "count=32junk&multiplier=oops&hiveInitialColonize=no&hiveMaxDensity=-1",
                ),
            ),
        ).toEqual(getDefaultParams())
    })
})

describe("star search lifecycle", () => {
    beforeEach(() => {
        vi.mocked(generateGalaxy).mockResolvedValue(galaxy(1))
    })

    it("prevents repeated starts and discards results after rules change", async () => {
        const pending = deferred<number[]>()
        vi.mocked(searchStar).mockReturnValue(pending.promise)
        route("/galaxy/1/search")
        await screen.findByText(/Find stars matching the following criteria/)
        fireEvent.click(searchPanel().getByRole("button", { name: "Search" }))
        fireEvent.click(
            searchPanel().getByRole("button", { name: "Searching..." }),
        )
        expect(searchStar).toHaveBeenCalledTimes(1)
        fireEvent.click(
            searchPanel().getByRole("button", { name: "Edit rules" }),
        )
        await act(async () => {
            pending.resolve([1])
        })
        expect(searchPanel().queryAllByRole("link")).toHaveLength(0)
    })

    it("keeps the new search result when an older request finishes later", async () => {
        const old = deferred<number[]>(),
            current = deferred<number[]>()
        vi.mocked(searchStar)
            .mockReturnValueOnce(old.promise)
            .mockReturnValueOnce(current.promise)
        route("/galaxy/1/search")
        await screen.findByText(/Find stars matching the following criteria/)
        fireEvent.click(searchPanel().getByRole("button", { name: "Search" }))
        fireEvent.click(
            searchPanel().getByRole("button", { name: "Edit rules" }),
        )
        fireEvent.click(searchPanel().getByRole("button", { name: "Search" }))
        await act(async () => {
            current.resolve([0])
        })
        expect(
            searchPanel().getByRole("link", { name: "Alpha #1" }),
        ).toBeTruthy()
        await act(async () => {
            old.resolve([1])
        })
        expect(
            searchPanel().queryByRole("link", { name: "Beta #2" }),
        ).toBeNull()
    })

    it("does not publish a result from a dismissed search after returning", async () => {
        const pending = deferred<number[]>()
        vi.mocked(searchStar).mockReturnValue(pending.promise)
        const { router } = route("/galaxy/1/search")
        await screen.findByText(/Find stars matching the following criteria/)
        fireEvent.click(searchPanel().getByRole("button", { name: "Search" }))
        await act(async () => {
            await router.navigate("/galaxy/1/0")
        })
        expect(screen.getByTestId("star-view")).toHaveTextContent("Alpha")
        await act(async () => {
            pending.resolve([1])
        })
        await act(async () => {
            await router.navigate("/galaxy/1/search")
        })
        expect(searchPanel().queryAllByRole("link")).toHaveLength(0)
        expect(generateGalaxy).toHaveBeenCalledTimes(1)
    })

    it("recovers from search rejection without locking the search button", async () => {
        vi.mocked(searchStar)
            .mockRejectedValueOnce(new Error("worker failure"))
            .mockResolvedValueOnce([1])
        route("/galaxy/1/search")
        await screen.findByText(/Find stars matching the following criteria/)
        fireEvent.click(searchPanel().getByRole("button", { name: "Search" }))
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Unable to search this galaxy.",
        )
        fireEvent.click(searchPanel().getByRole("button", { name: "Search" }))
        expect(
            await searchPanel().findByRole("link", { name: "Beta #2" }),
        ).toBeTruthy()
    })
})

describe("viewer scroll ownership", () => {
    it("starts each selected star at the top without regenerating unchanged galaxy data", async () => {
        vi.mocked(generateGalaxy).mockResolvedValue(galaxy(0))
        const view = route("/galaxy/0/0?count=32")
        const oldPane = (await screen.findByTestId("star-view")).parentElement!
        oldPane.scrollTop = 500
        await act(async () => view.router.navigate("/galaxy/0/1?count=32"))
        const newPane = screen.getByTestId("star-view").parentElement!
        expect(newPane).not.toBe(oldPane)
        expect(newPane.scrollTop).toBe(0)
        expect(screen.getByTestId("star-view")).toHaveTextContent("Beta")
        expect(generateGalaxy).toHaveBeenCalledTimes(1)
        await act(async () =>
            view.router.navigate("/galaxy/0/1?count=32#star-1-planet-3"),
        )
        expect(screen.getByTestId("star-view").parentElement).toBe(newPane)
    })
})
