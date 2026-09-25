/**
 * The places "What is in the sky tonight" (#36) can be seen from: cities, so a
 * child picks a country and a nearby city from a list and never types a
 * coordinate. A city stands for everything within a couple of hundred
 * kilometres: the sky there differs by minutes, not by what is up.
 *
 * Country names come from `Intl.DisplayNames` (no strings to translate); city
 * names are the English ones, with the name a shipped language uses where it
 * has its own (München, Curych, Ginebra, Vienne): the third column for German,
 * `EXONYMS` for Czech, Spanish and French. Coordinates to 0.01 deg, IANA time
 * zones.
 */

export interface City {
	/** Stable id ("zurich"). */
	readonly id: string
	readonly name: string
	/** The name in a language (by its code: "de", "cs", "es", "fr"), where it differs from `name`. */
	readonly names: Readonly<Partial<Record<string, string>>>
	/** ISO 3166-1 alpha-2 country code. */
	readonly country: string
	readonly latitude: number
	readonly longitude: number
	readonly timeZone: string
}

type Row = readonly [
	id: string,
	name: string,
	nameDe: string,
	country: string,
	latitude: number,
	longitude: number,
	timeZone: string,
]

// prettier-ignore
const ROWS: readonly Row[] = [
	// Switzerland, Germany, Austria and Liechtenstein first: the app's first classrooms
	["zurich", "Zurich", "Zürich", "CH", 47.37, 8.54, "Europe/Zurich"],
	["bern", "Bern", "", "CH", 46.95, 7.45, "Europe/Zurich"],
	["basel", "Basel", "", "CH", 47.56, 7.59, "Europe/Zurich"],
	["geneva", "Geneva", "Genf", "CH", 46.2, 6.14, "Europe/Zurich"],
	["lausanne", "Lausanne", "", "CH", 46.52, 6.63, "Europe/Zurich"],
	["lucerne", "Lucerne", "Luzern", "CH", 47.05, 8.31, "Europe/Zurich"],
	["st-gallen", "St. Gallen", "", "CH", 47.42, 9.37, "Europe/Zurich"],
	["winterthur", "Winterthur", "", "CH", 47.5, 8.72, "Europe/Zurich"],
	["lugano", "Lugano", "", "CH", 46.0, 8.95, "Europe/Zurich"],
	["chur", "Chur", "", "CH", 46.85, 9.53, "Europe/Zurich"],
	["sion", "Sion", "Sitten", "CH", 46.23, 7.36, "Europe/Zurich"],
	["neuchatel", "Neuchâtel", "Neuenburg", "CH", 46.99, 6.93, "Europe/Zurich"],
	["fribourg", "Fribourg", "Freiburg im Üechtland", "CH", 46.8, 7.15, "Europe/Zurich"],
	["aarau", "Aarau", "", "CH", 47.39, 8.04, "Europe/Zurich"],
	["schaffhausen", "Schaffhausen", "", "CH", 47.7, 8.63, "Europe/Zurich"],
	["thun", "Thun", "", "CH", 46.76, 7.63, "Europe/Zurich"],
	["zug", "Zug", "", "CH", 47.17, 8.52, "Europe/Zurich"],
	["bellinzona", "Bellinzona", "", "CH", 46.19, 9.02, "Europe/Zurich"],
	["vaduz", "Vaduz", "", "LI", 47.14, 9.52, "Europe/Vaduz"],
	["berlin", "Berlin", "", "DE", 52.52, 13.4, "Europe/Berlin"],
	["hamburg", "Hamburg", "", "DE", 53.55, 9.99, "Europe/Berlin"],
	["munich", "Munich", "München", "DE", 48.14, 11.58, "Europe/Berlin"],
	["cologne", "Cologne", "Köln", "DE", 50.94, 6.96, "Europe/Berlin"],
	["frankfurt", "Frankfurt", "Frankfurt am Main", "DE", 50.11, 8.68, "Europe/Berlin"],
	["stuttgart", "Stuttgart", "", "DE", 48.78, 9.18, "Europe/Berlin"],
	["dusseldorf", "Düsseldorf", "", "DE", 51.23, 6.78, "Europe/Berlin"],
	["dortmund", "Dortmund", "", "DE", 51.51, 7.47, "Europe/Berlin"],
	["leipzig", "Leipzig", "", "DE", 51.34, 12.37, "Europe/Berlin"],
	["dresden", "Dresden", "", "DE", 51.05, 13.74, "Europe/Berlin"],
	["hanover", "Hanover", "Hannover", "DE", 52.37, 9.73, "Europe/Berlin"],
	["nuremberg", "Nuremberg", "Nürnberg", "DE", 49.45, 11.08, "Europe/Berlin"],
	["bremen", "Bremen", "", "DE", 53.08, 8.8, "Europe/Berlin"],
	["freiburg", "Freiburg im Breisgau", "", "DE", 47.99, 7.85, "Europe/Berlin"],
	["kiel", "Kiel", "", "DE", 54.32, 10.14, "Europe/Berlin"],
	["rostock", "Rostock", "", "DE", 54.09, 12.1, "Europe/Berlin"],
	["erfurt", "Erfurt", "", "DE", 50.98, 11.03, "Europe/Berlin"],
	["mainz", "Mainz", "", "DE", 50.0, 8.27, "Europe/Berlin"],
	["saarbrucken", "Saarbrücken", "", "DE", 49.24, 6.99, "Europe/Berlin"],
	["konstanz", "Konstanz", "", "DE", 47.66, 9.18, "Europe/Berlin"],
	["regensburg", "Regensburg", "", "DE", 49.01, 12.1, "Europe/Berlin"],
	["magdeburg", "Magdeburg", "", "DE", 52.12, 11.63, "Europe/Berlin"],
	["vienna", "Vienna", "Wien", "AT", 48.21, 16.37, "Europe/Vienna"],
	["graz", "Graz", "", "AT", 47.07, 15.44, "Europe/Vienna"],
	["linz", "Linz", "", "AT", 48.31, 14.29, "Europe/Vienna"],
	["salzburg", "Salzburg", "", "AT", 47.81, 13.06, "Europe/Vienna"],
	["innsbruck", "Innsbruck", "", "AT", 47.27, 11.4, "Europe/Vienna"],
	["klagenfurt", "Klagenfurt", "", "AT", 46.62, 14.31, "Europe/Vienna"],
	["bregenz", "Bregenz", "", "AT", 47.5, 9.75, "Europe/Vienna"],
	// Europe
	["london", "London", "", "GB", 51.51, -0.13, "Europe/London"],
	["edinburgh", "Edinburgh", "", "GB", 55.95, -3.19, "Europe/London"],
	["manchester", "Manchester", "", "GB", 53.48, -2.24, "Europe/London"],
	["belfast", "Belfast", "", "GB", 54.6, -5.93, "Europe/London"],
	["cardiff", "Cardiff", "", "GB", 51.48, -3.18, "Europe/London"],
	["dublin", "Dublin", "", "IE", 53.35, -6.26, "Europe/Dublin"],
	["paris", "Paris", "", "FR", 48.86, 2.35, "Europe/Paris"],
	["lyon", "Lyon", "", "FR", 45.76, 4.84, "Europe/Paris"],
	["marseille", "Marseille", "", "FR", 43.3, 5.37, "Europe/Paris"],
	["strasbourg", "Strasbourg", "Straßburg", "FR", 48.57, 7.75, "Europe/Paris"],
	["toulouse", "Toulouse", "", "FR", 43.6, 1.44, "Europe/Paris"],
	["bordeaux", "Bordeaux", "", "FR", 44.84, -0.58, "Europe/Paris"],
	["nice", "Nice", "Nizza", "FR", 43.7, 7.27, "Europe/Paris"],
	["lille", "Lille", "", "FR", 50.63, 3.06, "Europe/Paris"],
	["nantes", "Nantes", "", "FR", 47.22, -1.55, "Europe/Paris"],
	["montpellier", "Montpellier", "", "FR", 43.61, 3.88, "Europe/Paris"],
	["rennes", "Rennes", "", "FR", 48.11, -1.68, "Europe/Paris"],
	["grenoble", "Grenoble", "", "FR", 45.19, 5.72, "Europe/Paris"],
	["dijon", "Dijon", "", "FR", 47.32, 5.04, "Europe/Paris"],
	["clermont-ferrand", "Clermont-Ferrand", "", "FR", 45.78, 3.08, "Europe/Paris"],
	["brest", "Brest", "", "FR", 48.39, -4.49, "Europe/Paris"],
	["ajaccio", "Ajaccio", "", "FR", 41.93, 8.74, "Europe/Paris"],
	["monaco", "Monaco", "", "MC", 43.74, 7.42, "Europe/Monaco"],
	["brussels", "Brussels", "Brüssel", "BE", 50.85, 4.35, "Europe/Brussels"],
	["antwerp", "Antwerp", "Antwerpen", "BE", 51.22, 4.4, "Europe/Brussels"],
	["liege", "Liège", "Lüttich", "BE", 50.63, 5.57, "Europe/Brussels"],
	["amsterdam", "Amsterdam", "", "NL", 52.37, 4.9, "Europe/Amsterdam"],
	["rotterdam", "Rotterdam", "", "NL", 51.92, 4.48, "Europe/Amsterdam"],
	["luxembourg", "Luxembourg", "Luxemburg", "LU", 49.61, 6.13, "Europe/Luxembourg"],
	["rome", "Rome", "Rom", "IT", 41.9, 12.5, "Europe/Rome"],
	["milan", "Milan", "Mailand", "IT", 45.46, 9.19, "Europe/Rome"],
	["turin", "Turin", "", "IT", 45.07, 7.69, "Europe/Rome"],
	["venice", "Venice", "Venedig", "IT", 45.44, 12.33, "Europe/Rome"],
	["florence", "Florence", "Florenz", "IT", 43.77, 11.26, "Europe/Rome"],
	["naples", "Naples", "Neapel", "IT", 40.85, 14.27, "Europe/Rome"],
	["bolzano", "Bolzano", "Bozen", "IT", 46.5, 11.35, "Europe/Rome"],
	["palermo", "Palermo", "", "IT", 38.12, 13.36, "Europe/Rome"],
	["madrid", "Madrid", "", "ES", 40.42, -3.7, "Europe/Madrid"],
	["barcelona", "Barcelona", "", "ES", 41.39, 2.17, "Europe/Madrid"],
	["seville", "Seville", "Sevilla", "ES", 37.39, -5.98, "Europe/Madrid"],
	["valencia", "Valencia", "", "ES", 39.47, -0.38, "Europe/Madrid"],
	["palma", "Palma", "Palma de Mallorca", "ES", 39.57, 2.65, "Europe/Madrid"],
	["bilbao", "Bilbao", "", "ES", 43.26, -2.93, "Europe/Madrid"],
	["zaragoza", "Zaragoza", "Saragossa", "ES", 41.65, -0.89, "Europe/Madrid"],
	["malaga", "Málaga", "", "ES", 36.72, -4.42, "Europe/Madrid"],
	["granada", "Granada", "", "ES", 37.18, -3.6, "Europe/Madrid"],
	["valladolid", "Valladolid", "", "ES", 41.65, -4.72, "Europe/Madrid"],
	["murcia", "Murcia", "", "ES", 37.99, -1.13, "Europe/Madrid"],
	["a-coruna", "A Coruña", "", "ES", 43.36, -8.41, "Europe/Madrid"],
	["las-palmas", "Las Palmas de Gran Canaria", "", "ES", 28.12, -15.44, "Atlantic/Canary"],
	["santa-cruz-tenerife", "Santa Cruz de Tenerife", "", "ES", 28.46, -16.25, "Atlantic/Canary"],
	["lisbon", "Lisbon", "Lissabon", "PT", 38.72, -9.14, "Europe/Lisbon"],
	["porto", "Porto", "", "PT", 41.15, -8.61, "Europe/Lisbon"],
	["copenhagen", "Copenhagen", "Kopenhagen", "DK", 55.68, 12.57, "Europe/Copenhagen"],
	["oslo", "Oslo", "", "NO", 59.91, 10.75, "Europe/Oslo"],
	["bergen", "Bergen", "", "NO", 60.39, 5.32, "Europe/Oslo"],
	["tromso", "Tromsø", "", "NO", 69.65, 18.96, "Europe/Oslo"],
	["stockholm", "Stockholm", "", "SE", 59.33, 18.07, "Europe/Stockholm"],
	["gothenburg", "Gothenburg", "Göteborg", "SE", 57.71, 11.97, "Europe/Stockholm"],
	["kiruna", "Kiruna", "", "SE", 67.86, 20.23, "Europe/Stockholm"],
	["helsinki", "Helsinki", "", "FI", 60.17, 24.94, "Europe/Helsinki"],
	["rovaniemi", "Rovaniemi", "", "FI", 66.5, 25.73, "Europe/Helsinki"],
	["reykjavik", "Reykjavík", "", "IS", 64.15, -21.94, "Atlantic/Reykjavik"],
	["tallinn", "Tallinn", "", "EE", 59.44, 24.75, "Europe/Tallinn"],
	["riga", "Riga", "", "LV", 56.95, 24.11, "Europe/Riga"],
	["vilnius", "Vilnius", "", "LT", 54.69, 25.28, "Europe/Vilnius"],
	["warsaw", "Warsaw", "Warschau", "PL", 52.23, 21.01, "Europe/Warsaw"],
	["krakow", "Kraków", "Krakau", "PL", 50.06, 19.94, "Europe/Warsaw"],
	["gdansk", "Gdańsk", "Danzig", "PL", 54.35, 18.65, "Europe/Warsaw"],
	["prague", "Prague", "Prag", "CZ", 50.08, 14.44, "Europe/Prague"],
	["brno", "Brno", "Brünn", "CZ", 49.2, 16.61, "Europe/Prague"],
	["ostrava", "Ostrava", "Ostrau", "CZ", 49.82, 18.26, "Europe/Prague"],
	["plzen", "Plzeň", "Pilsen", "CZ", 49.75, 13.38, "Europe/Prague"],
	["olomouc", "Olomouc", "Olmütz", "CZ", 49.59, 17.25, "Europe/Prague"],
	["ceske-budejovice", "České Budějovice", "Budweis", "CZ", 48.97, 14.47, "Europe/Prague"],
	["liberec", "Liberec", "Reichenberg", "CZ", 50.77, 15.06, "Europe/Prague"],
	["hradec-kralove", "Hradec Králové", "Königgrätz", "CZ", 50.21, 15.83, "Europe/Prague"],
	["bratislava", "Bratislava", "Pressburg", "SK", 48.15, 17.11, "Europe/Bratislava"],
	["kosice", "Košice", "Kaschau", "SK", 48.72, 21.26, "Europe/Bratislava"],
	["budapest", "Budapest", "", "HU", 47.5, 19.04, "Europe/Budapest"],
	["ljubljana", "Ljubljana", "Laibach", "SI", 46.06, 14.51, "Europe/Ljubljana"],
	["zagreb", "Zagreb", "", "HR", 45.81, 15.98, "Europe/Zagreb"],
	["split", "Split", "", "HR", 43.51, 16.44, "Europe/Zagreb"],
	["sarajevo", "Sarajevo", "", "BA", 43.86, 18.41, "Europe/Sarajevo"],
	["belgrade", "Belgrade", "Belgrad", "RS", 44.79, 20.45, "Europe/Belgrade"],
	["podgorica", "Podgorica", "", "ME", 42.44, 19.26, "Europe/Podgorica"],
	["pristina", "Pristina", "", "XK", 42.66, 21.17, "Europe/Belgrade"],
	["skopje", "Skopje", "", "MK", 42.0, 21.43, "Europe/Skopje"],
	["tirana", "Tirana", "", "AL", 41.33, 19.82, "Europe/Tirane"],
	["athens", "Athens", "Athen", "GR", 37.98, 23.73, "Europe/Athens"],
	["thessaloniki", "Thessaloniki", "", "GR", 40.64, 22.94, "Europe/Athens"],
	["sofia", "Sofia", "", "BG", 42.7, 23.32, "Europe/Sofia"],
	["bucharest", "Bucharest", "Bukarest", "RO", 44.43, 26.1, "Europe/Bucharest"],
	["chisinau", "Chișinău", "", "MD", 47.01, 28.86, "Europe/Chisinau"],
	["kyiv", "Kyiv", "Kiew", "UA", 50.45, 30.52, "Europe/Kyiv"],
	["lviv", "Lviv", "Lwiw", "UA", 49.84, 24.03, "Europe/Kyiv"],
	["odesa", "Odesa", "Odessa", "UA", 46.48, 30.72, "Europe/Kyiv"],
	["minsk", "Minsk", "", "BY", 53.9, 27.56, "Europe/Minsk"],
	["istanbul", "Istanbul", "", "TR", 41.01, 28.98, "Europe/Istanbul"],
	["ankara", "Ankara", "", "TR", 39.93, 32.86, "Europe/Istanbul"],
	["antalya", "Antalya", "", "TR", 36.9, 30.7, "Europe/Istanbul"],
	["valletta", "Valletta", "", "MT", 35.9, 14.51, "Europe/Malta"],
	["nicosia", "Nicosia", "Nikosia", "CY", 35.17, 33.36, "Asia/Nicosia"],
	["moscow", "Moscow", "Moskau", "RU", 55.76, 37.62, "Europe/Moscow"],
	["st-petersburg", "Saint Petersburg", "Sankt Petersburg", "RU", 59.93, 30.36, "Europe/Moscow"],
	["novosibirsk", "Novosibirsk", "Nowosibirsk", "RU", 55.03, 82.92, "Asia/Novosibirsk"],
	["vladivostok", "Vladivostok", "Wladiwostok", "RU", 43.12, 131.89, "Asia/Vladivostok"],
	// Middle East and Africa
	["tbilisi", "Tbilisi", "Tiflis", "GE", 41.72, 44.79, "Asia/Tbilisi"],
	["yerevan", "Yerevan", "Jerewan", "AM", 40.18, 44.51, "Asia/Yerevan"],
	["baku", "Baku", "", "AZ", 40.41, 49.87, "Asia/Baku"],
	["jerusalem", "Jerusalem", "", "IL", 31.77, 35.21, "Asia/Jerusalem"],
	["tel-aviv", "Tel Aviv", "", "IL", 32.09, 34.78, "Asia/Jerusalem"],
	["beirut", "Beirut", "", "LB", 33.89, 35.5, "Asia/Beirut"],
	["amman", "Amman", "", "JO", 31.95, 35.93, "Asia/Amman"],
	["damascus", "Damascus", "Damaskus", "SY", 33.51, 36.28, "Asia/Damascus"],
	["baghdad", "Baghdad", "Bagdad", "IQ", 33.31, 44.36, "Asia/Baghdad"],
	["tehran", "Tehran", "Teheran", "IR", 35.69, 51.39, "Asia/Tehran"],
	["riyadh", "Riyadh", "Riad", "SA", 24.71, 46.68, "Asia/Riyadh"],
	["dubai", "Dubai", "", "AE", 25.2, 55.27, "Asia/Dubai"],
	["doha", "Doha", "", "QA", 25.29, 51.53, "Asia/Qatar"],
	["kuwait", "Kuwait City", "Kuwait-Stadt", "KW", 29.38, 47.99, "Asia/Kuwait"],
	["muscat", "Muscat", "Maskat", "OM", 23.59, 58.41, "Asia/Muscat"],
	["cairo", "Cairo", "Kairo", "EG", 30.04, 31.24, "Africa/Cairo"],
	["casablanca", "Casablanca", "", "MA", 33.57, -7.59, "Africa/Casablanca"],
	["rabat", "Rabat", "", "MA", 34.02, -6.84, "Africa/Casablanca"],
	["algiers", "Algiers", "Algier", "DZ", 36.75, 3.06, "Africa/Algiers"],
	["tunis", "Tunis", "", "TN", 36.81, 10.18, "Africa/Tunis"],
	["tripoli", "Tripoli", "Tripolis", "LY", 32.89, 13.19, "Africa/Tripoli"],
	["dakar", "Dakar", "", "SN", 14.72, -17.47, "Africa/Dakar"],
	["accra", "Accra", "", "GH", 5.6, -0.19, "Africa/Accra"],
	["abidjan", "Abidjan", "", "CI", 5.36, -4.01, "Africa/Abidjan"],
	["bamako", "Bamako", "", "ML", 12.64, -8.0, "Africa/Bamako"],
	["ouagadougou", "Ouagadougou", "", "BF", 12.37, -1.52, "Africa/Ouagadougou"],
	["conakry", "Conakry", "", "GN", 9.64, -13.58, "Africa/Conakry"],
	["yaounde", "Yaoundé", "Jaunde", "CM", 3.85, 11.5, "Africa/Douala"],
	["malabo", "Malabo", "", "GQ", 3.75, 8.78, "Africa/Malabo"],
	["lagos", "Lagos", "", "NG", 6.52, 3.38, "Africa/Lagos"],
	["abuja", "Abuja", "", "NG", 9.08, 7.4, "Africa/Lagos"],
	["kinshasa", "Kinshasa", "", "CD", -4.44, 15.27, "Africa/Kinshasa"],
	["addis-ababa", "Addis Ababa", "Addis Abeba", "ET", 9.03, 38.74, "Africa/Addis_Ababa"],
	["nairobi", "Nairobi", "", "KE", -1.29, 36.82, "Africa/Nairobi"],
	["dar-es-salaam", "Dar es Salaam", "Daressalam", "TZ", -6.79, 39.21, "Africa/Dar_es_Salaam"],
	["kampala", "Kampala", "", "UG", 0.35, 32.58, "Africa/Kampala"],
	["kigali", "Kigali", "", "RW", -1.95, 30.06, "Africa/Kigali"],
	["luanda", "Luanda", "", "AO", -8.84, 13.23, "Africa/Luanda"],
	["lusaka", "Lusaka", "", "ZM", -15.39, 28.32, "Africa/Lusaka"],
	["harare", "Harare", "", "ZW", -17.83, 31.05, "Africa/Harare"],
	["windhoek", "Windhoek", "", "NA", -22.56, 17.08, "Africa/Windhoek"],
	["johannesburg", "Johannesburg", "", "ZA", -26.2, 28.05, "Africa/Johannesburg"],
	["cape-town", "Cape Town", "Kapstadt", "ZA", -33.92, 18.42, "Africa/Johannesburg"],
	["antananarivo", "Antananarivo", "", "MG", -18.88, 47.51, "Indian/Antananarivo"],
	["port-louis", "Port Louis", "", "MU", -20.16, 57.5, "Indian/Mauritius"],
	["saint-denis-reunion", "Saint-Denis", "", "RE", -20.88, 55.45, "Indian/Reunion"],
	// Asia
	["kabul", "Kabul", "", "AF", 34.53, 69.17, "Asia/Kabul"],
	["tashkent", "Tashkent", "Taschkent", "UZ", 41.3, 69.24, "Asia/Tashkent"],
	["almaty", "Almaty", "", "KZ", 43.24, 76.95, "Asia/Almaty"],
	["astana", "Astana", "", "KZ", 51.17, 71.45, "Asia/Almaty"],
	["karachi", "Karachi", "Karatschi", "PK", 24.86, 67.01, "Asia/Karachi"],
	["islamabad", "Islamabad", "", "PK", 33.68, 73.05, "Asia/Karachi"],
	["new-delhi", "New Delhi", "Neu-Delhi", "IN", 28.61, 77.21, "Asia/Kolkata"],
	["mumbai", "Mumbai", "", "IN", 19.08, 72.88, "Asia/Kolkata"],
	["kolkata", "Kolkata", "Kalkutta", "IN", 22.57, 88.36, "Asia/Kolkata"],
	["bengaluru", "Bengaluru", "", "IN", 12.97, 77.59, "Asia/Kolkata"],
	["chennai", "Chennai", "", "IN", 13.08, 80.27, "Asia/Kolkata"],
	["kathmandu", "Kathmandu", "", "NP", 27.72, 85.32, "Asia/Kathmandu"],
	["colombo", "Colombo", "", "LK", 6.93, 79.86, "Asia/Colombo"],
	["dhaka", "Dhaka", "", "BD", 23.81, 90.41, "Asia/Dhaka"],
	["yangon", "Yangon", "Rangun", "MM", 16.84, 96.17, "Asia/Yangon"],
	["bangkok", "Bangkok", "", "TH", 13.76, 100.5, "Asia/Bangkok"],
	["hanoi", "Hanoi", "", "VN", 21.03, 105.85, "Asia/Ho_Chi_Minh"],
	["ho-chi-minh-city", "Ho Chi Minh City", "Ho-Chi-Minh-Stadt", "VN", 10.82, 106.63, "Asia/Ho_Chi_Minh"],
	["phnom-penh", "Phnom Penh", "", "KH", 11.56, 104.93, "Asia/Phnom_Penh"],
	["kuala-lumpur", "Kuala Lumpur", "", "MY", 3.14, 101.69, "Asia/Kuala_Lumpur"],
	["singapore", "Singapore", "Singapur", "SG", 1.35, 103.82, "Asia/Singapore"],
	["jakarta", "Jakarta", "", "ID", -6.21, 106.85, "Asia/Jakarta"],
	["denpasar", "Denpasar (Bali)", "", "ID", -8.65, 115.22, "Asia/Makassar"],
	["manila", "Manila", "", "PH", 14.6, 120.98, "Asia/Manila"],
	["hong-kong", "Hong Kong", "Hongkong", "HK", 22.32, 114.17, "Asia/Hong_Kong"],
	["taipei", "Taipei", "", "TW", 25.03, 121.57, "Asia/Taipei"],
	["beijing", "Beijing", "Peking", "CN", 39.9, 116.41, "Asia/Shanghai"],
	["shanghai", "Shanghai", "Schanghai", "CN", 31.23, 121.47, "Asia/Shanghai"],
	["guangzhou", "Guangzhou", "Kanton", "CN", 23.13, 113.26, "Asia/Shanghai"],
	["chengdu", "Chengdu", "", "CN", 30.57, 104.07, "Asia/Shanghai"],
	["urumqi", "Ürümqi", "", "CN", 43.83, 87.62, "Asia/Urumqi"],
	["ulaanbaatar", "Ulaanbaatar", "", "MN", 47.89, 106.91, "Asia/Ulaanbaatar"],
	["seoul", "Seoul", "", "KR", 37.57, 126.98, "Asia/Seoul"],
	["busan", "Busan", "", "KR", 35.18, 129.08, "Asia/Seoul"],
	["tokyo", "Tokyo", "Tokio", "JP", 35.68, 139.69, "Asia/Tokyo"],
	["osaka", "Osaka", "", "JP", 34.69, 135.5, "Asia/Tokyo"],
	["sapporo", "Sapporo", "", "JP", 43.06, 141.35, "Asia/Tokyo"],
	// Oceania
	["sydney", "Sydney", "", "AU", -33.87, 151.21, "Australia/Sydney"],
	["melbourne", "Melbourne", "", "AU", -37.81, 144.96, "Australia/Melbourne"],
	["brisbane", "Brisbane", "", "AU", -27.47, 153.03, "Australia/Brisbane"],
	["perth", "Perth", "", "AU", -31.95, 115.86, "Australia/Perth"],
	["adelaide", "Adelaide", "", "AU", -34.93, 138.6, "Australia/Adelaide"],
	["darwin", "Darwin", "", "AU", -12.46, 130.84, "Australia/Darwin"],
	["hobart", "Hobart", "", "AU", -42.88, 147.33, "Australia/Hobart"],
	["canberra", "Canberra", "", "AU", -35.28, 149.13, "Australia/Sydney"],
	["auckland", "Auckland", "", "NZ", -36.85, 174.76, "Pacific/Auckland"],
	["wellington", "Wellington", "", "NZ", -41.29, 174.78, "Pacific/Auckland"],
	["christchurch", "Christchurch", "", "NZ", -43.53, 172.64, "Pacific/Auckland"],
	["suva", "Suva", "", "FJ", -18.14, 178.44, "Pacific/Fiji"],
	["noumea", "Nouméa", "", "NC", -22.27, 166.44, "Pacific/Noumea"],
	["papeete", "Papeete", "", "PF", -17.53, -149.57, "Pacific/Tahiti"],
	["honolulu", "Honolulu", "", "US", 21.31, -157.86, "Pacific/Honolulu"],
	// The Americas
	["new-york", "New York", "", "US", 40.71, -74.01, "America/New_York"],
	["washington", "Washington, D.C.", "", "US", 38.91, -77.04, "America/New_York"],
	["boston", "Boston", "", "US", 42.36, -71.06, "America/New_York"],
	["miami", "Miami", "", "US", 25.76, -80.19, "America/New_York"],
	["atlanta", "Atlanta", "", "US", 33.75, -84.39, "America/New_York"],
	["detroit", "Detroit", "", "US", 42.33, -83.05, "America/Detroit"],
	["chicago", "Chicago", "", "US", 41.88, -87.63, "America/Chicago"],
	["houston", "Houston", "", "US", 29.76, -95.37, "America/Chicago"],
	["dallas", "Dallas", "", "US", 32.78, -96.8, "America/Chicago"],
	["minneapolis", "Minneapolis", "", "US", 44.98, -93.27, "America/Chicago"],
	["new-orleans", "New Orleans", "", "US", 29.95, -90.07, "America/Chicago"],
	["denver", "Denver", "", "US", 39.74, -104.99, "America/Denver"],
	["phoenix", "Phoenix", "", "US", 33.45, -112.07, "America/Phoenix"],
	["salt-lake-city", "Salt Lake City", "", "US", 40.76, -111.89, "America/Denver"],
	["los-angeles", "Los Angeles", "", "US", 34.05, -118.24, "America/Los_Angeles"],
	["san-francisco", "San Francisco", "", "US", 37.77, -122.42, "America/Los_Angeles"],
	["seattle", "Seattle", "", "US", 47.61, -122.33, "America/Los_Angeles"],
	["anchorage", "Anchorage", "", "US", 61.22, -149.9, "America/Anchorage"],
	["toronto", "Toronto", "", "CA", 43.65, -79.38, "America/Toronto"],
	["montreal", "Montreal", "", "CA", 45.5, -73.57, "America/Toronto"],
	["ottawa", "Ottawa", "", "CA", 45.42, -75.7, "America/Toronto"],
	["quebec-city", "Quebec City", "Québec", "CA", 46.81, -71.21, "America/Toronto"],
	["halifax", "Halifax", "", "CA", 44.65, -63.57, "America/Halifax"],
	["winnipeg", "Winnipeg", "", "CA", 49.9, -97.14, "America/Winnipeg"],
	["edmonton", "Edmonton", "", "CA", 53.55, -113.49, "America/Edmonton"],
	["calgary", "Calgary", "", "CA", 51.05, -114.07, "America/Edmonton"],
	["vancouver", "Vancouver", "", "CA", 49.28, -123.12, "America/Vancouver"],
	["mexico-city", "Mexico City", "Mexiko-Stadt", "MX", 19.43, -99.13, "America/Mexico_City"],
	["guadalajara", "Guadalajara", "", "MX", 20.66, -103.35, "America/Mexico_City"],
	["cancun", "Cancún", "", "MX", 21.16, -86.85, "America/Cancun"],
	["monterrey", "Monterrey", "", "MX", 25.69, -100.32, "America/Monterrey"],
	["guatemala-city", "Guatemala City", "Guatemala-Stadt", "GT", 14.63, -90.51, "America/Guatemala"],
	["san-jose-cr", "San José", "", "CR", 9.93, -84.08, "America/Costa_Rica"],
	["san-salvador", "San Salvador", "", "SV", 13.69, -89.19, "America/El_Salvador"],
	["tegucigalpa", "Tegucigalpa", "", "HN", 14.07, -87.19, "America/Tegucigalpa"],
	["managua", "Managua", "", "NI", 12.11, -86.24, "America/Managua"],
	["panama-city", "Panama City", "Panama-Stadt", "PA", 8.98, -79.52, "America/Panama"],
	["havana", "Havana", "Havanna", "CU", 23.11, -82.37, "America/Havana"],
	["kingston", "Kingston", "", "JM", 18.0, -76.79, "America/Jamaica"],
	["santo-domingo", "Santo Domingo", "", "DO", 18.49, -69.93, "America/Santo_Domingo"],
	["san-juan", "San Juan", "", "PR", 18.47, -66.11, "America/Puerto_Rico"],
	["fort-de-france", "Fort-de-France", "", "MQ", 14.6, -61.07, "America/Martinique"],
	["bogota", "Bogotá", "", "CO", 4.71, -74.07, "America/Bogota"],
	["medellin", "Medellín", "", "CO", 6.24, -75.58, "America/Bogota"],
	["caracas", "Caracas", "", "VE", 10.48, -66.9, "America/Caracas"],
	["quito", "Quito", "", "EC", -0.18, -78.47, "America/Guayaquil"],
	["guayaquil", "Guayaquil", "", "EC", -2.19, -79.89, "America/Guayaquil"],
	["lima", "Lima", "", "PE", -12.05, -77.04, "America/Lima"],
	["cusco", "Cusco", "", "PE", -13.53, -71.97, "America/Lima"],
	["la-paz", "La Paz", "", "BO", -16.5, -68.15, "America/La_Paz"],
	["santa-cruz-bolivia", "Santa Cruz de la Sierra", "", "BO", -17.78, -63.18, "America/La_Paz"],
	["santiago", "Santiago de Chile", "", "CL", -33.45, -70.67, "America/Santiago"],
	["buenos-aires", "Buenos Aires", "", "AR", -34.6, -58.38, "America/Argentina/Buenos_Aires"],
	["cordoba-ar", "Córdoba", "", "AR", -31.42, -64.18, "America/Argentina/Cordoba"],
	["montevideo", "Montevideo", "", "UY", -34.9, -56.16, "America/Montevideo"],
	["asuncion", "Asunción", "", "PY", -25.26, -57.58, "America/Asuncion"],
	["sao-paulo", "São Paulo", "", "BR", -23.55, -46.63, "America/Sao_Paulo"],
	["rio-de-janeiro", "Rio de Janeiro", "", "BR", -22.91, -43.17, "America/Sao_Paulo"],
	["brasilia", "Brasília", "", "BR", -15.79, -47.88, "America/Sao_Paulo"],
	["manaus", "Manaus", "", "BR", -3.12, -60.02, "America/Manaus"],
	["cayenne", "Cayenne", "", "GF", 4.92, -52.31, "America/Cayenne"],
]

type Language = "cs" | "es" | "fr"

/** Czech, Spanish and French names of cities, where they differ from the English one. */
// prettier-ignore
const EXONYMS: Readonly<Record<string, Partial<Record<Language, string>>>> = {
	zurich: { cs: "Curych", es: "Zúrich" },
	geneva: { cs: "Ženeva", es: "Ginebra", fr: "Genève" },
	basel: { cs: "Basilej", es: "Basilea", fr: "Bâle" },
	bern: { es: "Berna", fr: "Berne" },
	lausanne: { es: "Lausana" },
	lucerne: { cs: "Lucern", es: "Lucerna" },
	"st-gallen": { cs: "Svatý Havel", es: "San Galo", fr: "Saint-Gall" },
	chur: { fr: "Coire" },
	sion: { fr: "Sion" },
	fribourg: { es: "Friburgo" },
	schaffhausen: { cs: "Šafhúzy", es: "Schaffhausen", fr: "Schaffhouse" },
	thun: { fr: "Thoune" },
	zug: { fr: "Zoug" },
	berlin: { cs: "Berlín", es: "Berlín" },
	hamburg: { cs: "Hamburk", es: "Hamburgo", fr: "Hambourg" },
	munich: { cs: "Mnichov", es: "Múnich" },
	cologne: { cs: "Kolín nad Rýnem", es: "Colonia" },
	frankfurt: { cs: "Frankfurt nad Mohanem", es: "Fráncfort", fr: "Francfort" },
	dusseldorf: { es: "Düsseldorf", fr: "Düsseldorf" },
	leipzig: { cs: "Lipsko" },
	dresden: { cs: "Drážďany", es: "Dresde", fr: "Dresde" },
	hanover: { cs: "Hannover", es: "Hannover", fr: "Hanovre" },
	nuremberg: { cs: "Norimberk", es: "Núremberg" },
	bremen: { cs: "Brémy", fr: "Brême" },
	freiburg: { cs: "Freiburg", es: "Friburgo de Brisgovia", fr: "Fribourg-en-Brisgau" },
	mainz: { cs: "Mohuč", es: "Maguncia", fr: "Mayence" },
	saarbrucken: { fr: "Sarrebruck" },
	konstanz: { cs: "Kostnice", es: "Constanza", fr: "Constance" },
	regensburg: { cs: "Řezno", es: "Ratisbona", fr: "Ratisbonne" },
	magdeburg: { cs: "Magdeburk", es: "Magdeburgo", fr: "Magdebourg" },
	vienna: { cs: "Vídeň", es: "Viena", fr: "Vienne" },
	graz: { cs: "Štýrský Hradec" },
	linz: { cs: "Linec" },
	salzburg: { cs: "Salcburk", es: "Salzburgo", fr: "Salzbourg" },
	klagenfurt: { cs: "Celovec" },
	london: { cs: "Londýn", es: "Londres", fr: "Londres" },
	edinburgh: { es: "Edimburgo", fr: "Édimbourg" },
	dublin: { es: "Dublín" },
	paris: { cs: "Paříž", es: "París" },
	marseille: { es: "Marsella" },
	strasbourg: { cs: "Štrasburk", es: "Estrasburgo" },
	toulouse: { es: "Toulouse" },
	bordeaux: { es: "Burdeos" },
	nice: { es: "Niza" },
	monaco: { cs: "Monako", es: "Mónaco" },
	brussels: { cs: "Brusel", es: "Bruselas", fr: "Bruxelles" },
	antwerp: { es: "Amberes", fr: "Anvers" },
	liege: { cs: "Lutych", es: "Lieja" },
	amsterdam: { es: "Ámsterdam" },
	rotterdam: { es: "Róterdam" },
	luxembourg: { cs: "Lucemburk", es: "Luxemburgo" },
	rome: { cs: "Řím", es: "Roma" },
	milan: { cs: "Milán", es: "Milán" },
	turin: { cs: "Turín", es: "Turín" },
	venice: { cs: "Benátky", es: "Venecia", fr: "Venise" },
	florence: { cs: "Florencie", es: "Florencia" },
	naples: { cs: "Neapol", es: "Nápoles" },
	palermo: { fr: "Palerme" },
	barcelona: { fr: "Barcelone" },
	seville: { es: "Sevilla", fr: "Séville", cs: "Sevilla" },
	valencia: { cs: "Valencie", fr: "Valence" },
	zaragoza: { fr: "Saragosse" },
	malaga: { cs: "Málaga" },
	"a-coruna": { fr: "La Corogne" },
	lisbon: { cs: "Lisabon", es: "Lisboa", fr: "Lisbonne" },
	porto: { es: "Oporto" },
	copenhagen: { cs: "Kodaň", es: "Copenhague", fr: "Copenhague" },
	stockholm: { es: "Estocolmo" },
	gothenburg: { cs: "Göteborg", es: "Gotemburgo", fr: "Göteborg" },
	helsinki: { cs: "Helsinky" },
	reykjavik: { es: "Reikiavik", fr: "Reykjavik" },
	tallinn: { es: "Tallin" },
	vilnius: { es: "Vilna" },
	warsaw: { cs: "Varšava", es: "Varsovia", fr: "Varsovie" },
	krakow: { cs: "Krakov", es: "Cracovia", fr: "Cracovie" },
	gdansk: { cs: "Gdaňsk", es: "Gdansk" },
	prague: { cs: "Praha", es: "Praga" },
	budapest: { cs: "Budapešť" },
	ljubljana: { cs: "Lublaň", es: "Liubliana" },
	zagreb: { cs: "Záhřeb" },
	belgrade: { cs: "Bělehrad", es: "Belgrado" },
	pristina: { cs: "Priština", es: "Pristina" },
	skopje: { es: "Skopie" },
	athens: { cs: "Atény", es: "Atenas", fr: "Athènes" },
	thessaloniki: { cs: "Soluň", es: "Salónica", fr: "Thessalonique" },
	sofia: { cs: "Sofie", es: "Sofía" },
	bucharest: { cs: "Bukurešť", es: "Bucarest", fr: "Bucarest" },
	chisinau: { cs: "Kišiněv", es: "Chisináu" },
	kyiv: { cs: "Kyjev", es: "Kiev" },
	lviv: { cs: "Lvov", es: "Leópolis" },
	odesa: { cs: "Oděsa", es: "Odesa", fr: "Odessa" },
	istanbul: { es: "Estambul" },
	valletta: { es: "La Valeta", fr: "La Valette" },
	nicosia: { cs: "Nikósie", fr: "Nicosie" },
	moscow: { cs: "Moskva", es: "Moscú", fr: "Moscou" },
	"st-petersburg": { cs: "Petrohrad", es: "San Petersburgo", fr: "Saint-Pétersbourg" },
	novosibirsk: { cs: "Novosibirsk" },
	vladivostok: { cs: "Vladivostok" },
	tbilisi: { es: "Tiflis", fr: "Tbilissi" },
	yerevan: { cs: "Jerevan", es: "Ereván", fr: "Erevan" },
	baku: { es: "Bakú", fr: "Bakou" },
	jerusalem: { cs: "Jeruzalém", es: "Jerusalén", fr: "Jérusalem" },
	"tel-aviv": { cs: "Tel Aviv" },
	beirut: { cs: "Bejrút", fr: "Beyrouth" },
	amman: { cs: "Ammán", es: "Amán" },
	damascus: { cs: "Damašek", es: "Damasco", fr: "Damas" },
	baghdad: { cs: "Bagdád", es: "Bagdad", fr: "Bagdad" },
	tehran: { cs: "Teherán", es: "Teherán", fr: "Téhéran" },
	riyadh: { cs: "Rijád", es: "Riad", fr: "Riyad" },
	dubai: { cs: "Dubaj", es: "Dubái", fr: "Dubaï" },
	kuwait: { cs: "Kuvajt", es: "Kuwait", fr: "Koweït" },
	muscat: { cs: "Maskat", es: "Mascate", fr: "Mascate" },
	cairo: { cs: "Káhira", es: "El Cairo", fr: "Le Caire" },
	algiers: { cs: "Alžír", es: "Argel", fr: "Alger" },
	tunis: { es: "Túnez" },
	tripoli: { cs: "Tripolis", es: "Trípoli" },
	accra: { es: "Acra" },
	abuja: { es: "Abuya" },
	kinshasa: { es: "Kinsasa" },
	"addis-ababa": { cs: "Addis Abeba", es: "Adís Abeba", fr: "Addis-Abeba" },
	"dar-es-salaam": { cs: "Dar es Salaam", es: "Dar es-Salam" },
	"cape-town": { cs: "Kapské Město", es: "Ciudad del Cabo", fr: "Le Cap" },
	johannesburg: { es: "Johannesburgo" },
	yaounde: { cs: "Yaoundé" },
	kabul: { cs: "Kábul", fr: "Kaboul" },
	tashkent: { cs: "Taškent", es: "Taskent", fr: "Tachkent" },
	karachi: { cs: "Karáčí", fr: "Karachi" },
	"new-delhi": { cs: "Nové Dillí", es: "Nueva Delhi", fr: "New Delhi" },
	mumbai: { es: "Bombay", fr: "Bombay" },
	kolkata: { cs: "Kalkata", es: "Calcuta", fr: "Calcutta" },
	kathmandu: { cs: "Káthmándú", es: "Katmandú", fr: "Katmandou" },
	dhaka: { cs: "Dháka", es: "Daca" },
	yangon: { cs: "Rangún", es: "Rangún" },
	hanoi: { cs: "Hanoj", es: "Hanói", fr: "Hanoï" },
	"ho-chi-minh-city": { cs: "Ho Či Minovo Město", es: "Ciudad Ho Chi Minh", fr: "Hô Chi Minh-Ville" },
	"phnom-penh": { cs: "Phnompenh", es: "Nom Pen" },
	singapore: { cs: "Singapur", es: "Singapur", fr: "Singapour" },
	jakarta: { cs: "Jakarta", es: "Yakarta" },
	manila: { fr: "Manille" },
	"hong-kong": { cs: "Hongkong" },
	taipei: { cs: "Tchaj-pej", es: "Taipéi" },
	beijing: { cs: "Peking", es: "Pekín", fr: "Pékin" },
	shanghai: { cs: "Šanghaj", es: "Shanghái" },
	guangzhou: { cs: "Kanton", es: "Cantón", fr: "Canton" },
	seoul: { cs: "Soul", es: "Seúl", fr: "Séoul" },
	tokyo: { cs: "Tokio", es: "Tokio" },
	sydney: { es: "Sídney" },
	honolulu: { es: "Honolulú" },
	"new-york": { es: "Nueva York" },
	washington: { es: "Washington D. C.", fr: "Washington" },
	"new-orleans": { es: "Nueva Orleans", fr: "La Nouvelle-Orléans" },
	"los-angeles": { es: "Los Ángeles" },
	montreal: { fr: "Montréal" },
	"quebec-city": { cs: "Québec", es: "Quebec", fr: "Québec" },
	"mexico-city": { cs: "Ciudad de México", es: "Ciudad de México", fr: "Mexico" },
	"guatemala-city": { cs: "Guatemala", es: "Ciudad de Guatemala", fr: "Guatemala" },
	"panama-city": { cs: "Panamá", es: "Ciudad de Panamá", fr: "Panama" },
	havana: { cs: "Havana", es: "La Habana", fr: "La Havane" },
	bogota: { cs: "Bogota", fr: "Bogota" },
	"sao-paulo": { cs: "São Paulo" },
}

export const CITIES: readonly City[] = ROWS.map(
	([id, name, nameDe, country, latitude, longitude, timeZone]) => ({
		id,
		name,
		names: Object.fromEntries(
			Object.entries({ de: nameDe, ...EXONYMS[id] }).filter(
				([, exonym]) => exonym !== "" && exonym !== name,
			),
		),
		country,
		latitude,
		longitude,
		timeZone,
	}),
)

/** Every city that has Czech, Spanish or French names (for the tests: no stray ids). */
export const EXONYM_IDS: readonly string[] = Object.keys(EXONYMS)

export const cityById: ReadonlyMap<string, City> = new Map(
	CITIES.map((city) => [city.id, city]),
)

/** The city's name in `locale` ("de-CH": München, "cs": Mnichov). */
export const cityName = (city: City, locale: string): string =>
	city.names[locale.split("-")[0].toLowerCase()] ?? city.name

const regionNames = new Map<string, Intl.DisplayNames | null>()

/** The country's name in `locale` from `Intl` ("Schweiz"), else its code. */
export function countryName(code: string, locale: string): string {
	let names = regionNames.get(locale)
	if (names === undefined) {
		try {
			names = new Intl.DisplayNames([locale], { type: "region" })
		} catch {
			names = null
		}
		regionNames.set(locale, names)
	}
	try {
		return names?.of(code) ?? code
	} catch {
		return code
	}
}

/** Every country of the list, by its name in `locale`. */
export function countries(locale: string): { code: string; name: string }[] {
	const codes = [...new Set(CITIES.map((city) => city.country))]
	const collator = new Intl.Collator(locale)
	return codes
		.map((code) => ({ code, name: countryName(code, locale) }))
		.sort((a, b) => collator.compare(a.name, b.name))
}

/** The cities of a country, by name in `locale`. */
export function citiesOf(country: string, locale: string): City[] {
	const collator = new Intl.Collator(locale)
	return CITIES.filter((city) => city.country === country).sort((a, b) =>
		collator.compare(cityName(a, locale), cityName(b, locale)),
	)
}

/** Old IANA names some browsers still report, to the names the list uses. */
const ZONE_ALIASES: Readonly<Record<string, string>> = {
	"Asia/Calcutta": "Asia/Kolkata",
	"Asia/Saigon": "Asia/Ho_Chi_Minh",
	"Asia/Katmandu": "Asia/Kathmandu",
	"Asia/Rangoon": "Asia/Yangon",
	"Europe/Kiev": "Europe/Kyiv",
	"America/Buenos_Aires": "America/Argentina/Buenos_Aires",
	"Australia/ACT": "Australia/Sydney",
	"Australia/NSW": "Australia/Sydney",
	"Australia/Canberra": "Australia/Sydney",
	"Europe/Busingen": "Europe/Zurich",
	"US/Eastern": "America/New_York",
	"US/Central": "America/Chicago",
	"US/Mountain": "America/Denver",
	"US/Pacific": "America/Los_Angeles",
}

/** The name at the end of an IANA zone, as a city name ("America/New_York" -> "New York"). */
const zoneCity = (zone: string): string =>
	(zone.split("/").pop() ?? "").replace(/_/g, " ")

/**
 * The city to suggest before anybody chose one, from what the browser tells
 * every page without asking: its time zone (the zone's own city, else any
 * city in that zone), else the region of its preferred language ("de-CH":
 * Switzerland), else London. Only a suggestion: the panel asks.
 */
export function suggestedCity(
	timeZone: string | undefined,
	languages: readonly string[] = [],
): City {
	const zone =
		timeZone === undefined ? undefined : (ZONE_ALIASES[timeZone] ?? timeZone)
	if (zone !== undefined) {
		const inZone = CITIES.filter((city) => city.timeZone === zone)
		const own = inZone.find(
			(city) =>
				city.name === zoneCity(zone) ||
				Object.values(city.names).includes(zoneCity(zone)),
		)
		if (own !== undefined) return own
		if (inZone.length > 0) return inZone[0]
	}
	for (const language of languages) {
		let region: string | undefined
		try {
			region = new Intl.Locale(language).maximize().region
		} catch {
			region = undefined
		}
		const city = CITIES.find((c) => c.country === region)
		if (city !== undefined) return city
	}
	return cityById.get("london") ?? CITIES[0]
}

/** Great-circle distance in km between two points (degrees). */
export function distanceKm(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	const rad = Math.PI / 180
	const dLat = (lat2 - lat1) * rad
	const dLon = (lon2 - lon1) * rad
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
	return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** The nearest city of the list, if one is within `maxKm`. */
export function nearestCity(
	latitude: number,
	longitude: number,
	maxKm = 150,
): City | null {
	let best: City | null = null
	let bestKm = maxKm
	for (const city of CITIES) {
		const km = distanceKm(latitude, longitude, city.latitude, city.longitude)
		if (km <= bestKm) {
			best = city
			bestKm = km
		}
	}
	return best
}
