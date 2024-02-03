import { Url } from "next/dist/shared/lib/router/router"
import { NextRouter } from "next/router"

type QueryParam = string | string[] | number | number[] | never[] // pass [] to remove a query

export const setQueryOnPage = (
	router: NextRouter,
	query: { [paramName: string]: QueryParam },
) => {
	const url: Url = {
		pathname: router.pathname,
		query: { ...router.query, ...query },
	}

	const as: Url = {
		pathname: router.asPath?.split("?")[0],
		query: { ...router.query, ...query },
	}

	router.replace(url, as, { shallow: true, scroll: false })
}
