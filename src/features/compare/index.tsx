/**
 * Side by side (#24): two or more bodies at true relative size, independent
 * of where they are in the system, with comparisons a class can discuss.
 * The whole comparison lives in the link (`/compare?bodies=earth,jupiter`,
 * plus `t` for a moment other than now), so a teacher can prepare it, share
 * it and screenshot it. Reached from the focused body's card ("Compare
 * with…") and by link; see docs/ARCHITECTURE.md, "Comparison".
 */
import { useLayoutEffect, useMemo, useState } from "react"
import { Button } from "@mantine/core"
import { IconArrowLeft } from "@tabler/icons-react"
import { getRouteApi, useCanGoBack, useRouter } from "@tanstack/react-router"

import { LanguageMenu, useI18n } from "@/i18n"
import { dateToJD } from "@/sim"

import FactsPanel from "./FactsPanel"
import Pickers from "./Pickers"
import { completeBodies, formatBodies, parseBodies, promote } from "./selection"
import Stage from "./Stage"

import classes from "./Compare.module.css"

const route = getRouteApi("/compare")

const Compare = () => {
	const { t } = useI18n()
	const search = route.useSearch()
	const navigate = route.useNavigate()
	const router = useRouter()
	const canGoBack = useCanGoBack()
	const ids = useMemo(
		() => completeBodies(parseBodies(search.bodies)),
		[search.bodies],
	)
	// "now" is the moment the page opened: the numbers hold still while the class talks
	const [nowJD] = useState(() => dateToJD(new Date()))
	const live = search.t === undefined
	const jd = search.t ?? nowJD

	const setIds = (next: readonly string[]) =>
		void navigate({
			search: (previous) => ({ ...previous, bodies: formatBodies(next) }),
			replace: true,
		})

	// the address bar always states the comparison on screen, so it can be shared as it is
	const listed = formatBodies(ids)
	useLayoutEffect(() => {
		if (search.bodies !== listed) {
			void navigate({
				search: (previous) => ({ ...previous, bodies: listed }),
				replace: true,
			})
		}
	}, [search.bodies, listed, navigate])

	const back = () => {
		if (canGoBack) router.history.back()
		else void navigate({ to: "/solar_system", search: { focus: ids[0] } })
	}

	return (
		<main className={classes.page} data-testid="compare-page">
			<LanguageMenu placement="corner" />
			<header className={classes.header}>
				<Button
					variant="subtle"
					color="gray"
					leftSection={<IconArrowLeft size={18} />}
					onClick={back}
				>
					{t("compare.back")}
				</Button>
				<div className={classes.heading}>
					<h1 className={classes.title}>{t("compare.title")}</h1>
					<p className={classes.subtitle}>{t("compare.subtitle")}</p>
				</div>
			</header>
			<Pickers ids={ids} onChange={setIds} />
			<Stage ids={ids} onPick={(id) => setIds(promote(ids, id))} />
			<FactsPanel
				a={ids[0]}
				b={ids[1]}
				more={ids.length > 2}
				jd={jd}
				live={live}
			/>
			<footer className={classes.footer}>{t("app.name")}</footer>
		</main>
	)
}

export default Compare
