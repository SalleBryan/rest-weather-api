# Weather platform research, 4 November 2026

## Method and limits

Reviewed **169 distinct weather platforms and interfaces** from 277 first-party URL candidates before implementing this release. Categories: air-quality: 5, consumer: 58, official: 62, outdoor: 23, specialist: 13, station: 8. This is a source and navigation review, not 169 hands-on usability tests. Readable product pages, official service navigation, documentation, and repository feature descriptions supplied the broad comparison. Ten product pages received a closer browser visual review: Hello Weather, Weathergraph, Weawow, Foreca, Yr, MeteoSwiss, Windguru, OpenSnow, Mercury, and RainViewer. Some pages showed loading placeholders or interstitials; these are recorded as page reviews, not successful forecast interactions. Twelve-plus relevant product/documentation sources received deeper feature reading.

Collection yielded 210 readable extracts, 27 thin/script-only responses, and 40 failures. Removed duplicates/regional editions, API-only catalogs, ambiguous identities, retired or unreliable pages, and indirect flight-planning products. No CAPTCHA or access-control bypass. [Registry](platforms.json) contains dated canonical/resolved links and short source evidence. Evidence is descriptive, not an automatically inferred feature checklist. Candidate collection and exclusions are preserved separately. No quantitative feature-prevalence or forecast-accuracy claims follow from this sample. Full source extracts are not redistributed.

## Findings translated into implementation

| Product evidence | Decision for Weather Board | Boundary |
| --- | --- | --- |
| [Hello Weather](https://helloweather.com/) presents current, hourly, and daily conditions with detail on demand. [Mercury](https://mercuryweather.app/) emphasizes a compact current reading and forecast. | Keep one expressive current-weather focal point, with quieter supporting panels and clickable days. | Do not copy branding or add unrelated animated decoration. |
| [Pixel Weather](https://support.google.com/pixelphone/answer/15266029) documents saved locations, name/area/postal search, units, and detail blocks. [Windfinder](https://www.windfinder.com/apps) describes favorite forecast spots. [Climatempo](https://www.climatempo.com.br/) exposes favorite places and recent searches. | Separate Places destination, bounded favorites and recents, clear local-only storage, explicit deletion. | Do not fetch every saved place automatically. No silent geolocation permission. |
| [Foreca](https://www.foreca.com/) links daily summaries to hourly detail and distinguishes observation age from forecast updates. [Weathergraph](https://weathergraph.app/) organizes multiple metrics over time. | A day opens an accessible detail sheet using hourly data already fetched. Show model time, fetch time, timezone, and unavailable values. | Model estimates never become station observations; missing data is not zero. |
| [Prognoza](https://github.com/davidtakac/prognoza) explicitly describes offline forecasts. [PredictWind Offshore](https://www.predictwind.com/apps/offshore-app) prioritizes bounded downloads for intermittent connectivity. | Cache the app shell and a bounded set of forecast snapshots; restore without a request and label stale data. | Offline does not produce updated weather. Do not cache credentials or journal responses in the service worker. |
| [OpenSnow](https://opensnow.com/) describes favorite locations and forecast comparison. Weathergraph and PredictWind compare models, which is a different task. | Compare up to three places from one provider with common units and explicit timezones. Refresh intentionally and show failures per place. | No implication of multi-model confidence or consensus. Align hourly comparisons by UTC instant. |
| [PWSWeather](https://www.pwsweather.com/) centers station data and its history; [WeatherBug](https://www.weatherbug.com/) shows update times and condition detail. | Import a forecast only after connection and payload preview; preserve Open-Meteo attribution, coordinates, model timestamp, and imported source. | Explicit Save only, no background writes or automatic POST retries. |
| [Breezy Weather](https://github.com/breezy-weather/breezy-weather) uses Material 3 Expressive and describes accessibility, units, charts, and configurable sources. | Retain shared tonal roles, shape, expressive typography, consistent navigation, 48px controls, semantic tables, keyboard access, and reduced motion. | Custom web implementation; no vendor certification or copied GPL implementation. |

National service portals contribute useful patterns for clear local forecast search, timestamps, warnings, and separation of institutional content. Weather Board will keep its core task focused: no radar subscription, AI summary service, continuous polling, or paid map integration in this release.

## Material guidance read directly

The existing [design study](../DESIGN.md) covers color roles, shape, typography, search, buttons, navigation, and motion. This release additionally reviewed [bottom-sheet guidance](https://m3.material.io/components/bottom-sheets/guidelines) and [carousel overview](https://m3.material.io/components/carousel/overview). Use a compact bottom sheet and a bounded expanded dialog for supplementary day details; provide close and expansion controls, modal focus behavior, and internal scrolling. Place collections remain a readable grid/list. Forecast data does not need a decorative image carousel with parallax.

## Reviewed platform registry

All rows below received source/navigation review. Source text can contain translated or regional navigation; this is not evidence that every platform supports worldwide forecasts or every listed feature.

| # | First-party platform/interface source | Category |
| --- | --- | --- |
| 1 | [3B Meteo](https://www.3bmeteo.com/) | consumer |
| 2 | [AccuWeather](https://www.accuweather.com/) | consumer |
| 3 | [AEMET](https://www.aemet.es/en/portada) | official |
| 4 | [Airly](https://airly.org/en/) | air-quality |
| 5 | [AirMatters](https://air-matters.com/) | air-quality |
| 6 | [AirNow](https://www.airnow.gov/) | air-quality |
| 7 | [Apple Weather](https://support.apple.com/guide/iphone/check-the-weather-iph1ac0b35f/ios) | consumer |
| 8 | [Australian Bureau of Meteorology](https://www.bom.gov.au/) | official |
| 9 | [Bangladesh Meteorological Department](https://www.bmd.gov.bd/) | official |
| 10 | [BBC Weather](https://www.bbc.com/weather) | consumer |
| 11 | [Blitzortung](https://www.blitzortung.org/) | specialist |
| 12 | [Brazil INMET](https://portal.inmet.gov.br/) | official |
| 13 | [Breezy Weather](https://github.com/breezy-weather/breezy-weather) | consumer |
| 14 | [Buienalarm](https://www.buienalarm.nl/) | consumer |
| 15 | [Buienradar](https://www.buienradar.nl/) | consumer |
| 16 | [Buoyweather](https://www.buoyweather.com/) | outdoor |
| 17 | [CARROT Weather](https://www.meetcarrot.com/weather/) | consumer |
| 18 | [Climatempo](https://www.climatempo.com.br/) | consumer |
| 19 | [Clime](https://climeradar.com/) | consumer |
| 20 | [College of DuPage Weather](https://weather.cod.edu/) | specialist |
| 21 | [Croatian DHMZ](https://meteo.hr/) | official |
| 22 | [Czech Hydrometeorological Institute](https://www.chmi.cz/) | official |
| 23 | [Danish Meteorological Institute](https://www.dmi.dk/) | official |
| 24 | [Deutscher Wetterdienst](https://www.dwd.de/EN/Home/home_node.html) | official |
| 25 | [DTN Weather](https://www.dtn.com/weather/) | specialist |
| 26 | [Earth Nullschool](https://earth.nullschool.net/) | specialist |
| 27 | [Eltiempo.es](https://www.eltiempo.es/) | consumer |
| 28 | [Environment Canada](https://weather.gc.ca/) | official |
| 29 | [Estonian Weather Service](https://www.ilmateenistus.ee/?lang=en) | official |
| 30 | [Fiji Meteorological Service](https://www.met.gov.fj/) | official |
| 31 | [Finnish Meteorological Institute](https://en.ilmatieteenlaitos.fi/) | official |
| 32 | [Foreca](https://www.foreca.com/) | consumer |
| 33 | [GeoSphere Austria](https://www.geosphere.at/en) | official |
| 34 | [Ghana Meteorological Agency](https://www.meteo.gov.gh/) | official |
| 35 | [Google Weather](https://support.google.com/pixelphone/answer/15266029) | consumer |
| 36 | [Hello Weather](https://helloweather.com/) | consumer |
| 37 | [Hong Kong Observatory](https://www.hko.gov.hk/en/index.html) | official |
| 38 | [HungaroMet](https://www.met.hu/en/) | official |
| 39 | [Il Meteo](https://www.ilmeteo.it/) | consumer |
| 40 | [India Meteorological Department](https://mausam.imd.gov.in/) | official |
| 41 | [Indonesia BMKG](https://www.bmkg.go.id/) | official |
| 42 | [Infoclimat](https://www.infoclimat.fr/) | consumer |
| 43 | [IPMA](https://www.ipma.pt/en/) | official |
| 44 | [Israel Meteorological Service](https://ims.gov.il/en) | official |
| 45 | [Japan Meteorological Agency](https://www.jma.go.jp/jma/en/menu.html) | official |
| 46 | [Japan Weather Association tenki.jp](https://tenki.jp/) | consumer |
| 47 | [Kachelmannwetter](https://kachelmannwetter.com/) | consumer |
| 48 | [Kenya Meteorological Department](https://meteo.go.ke/) | official |
| 49 | [Keraunos](https://www.keraunos.org/) | specialist |
| 50 | [KNMI](https://www.knmi.nl/) | official |
| 51 | [Korea Meteorological Administration](https://www.weather.go.kr/w/index.do) | official |
| 52 | [La Chaine Meteo](https://www.lachainemeteo.com/) | consumer |
| 53 | [Lithuanian Hydrometeorological Service](https://www.meteo.lt/en/) | official |
| 54 | [Maldives Meteorological Service](https://www.meteorology.gov.mv/) | official |
| 55 | [Malta Weather](https://www.maltairport.com/weather/) | official |
| 56 | [Mauritius Meteorological Services](https://metservice.intnet.mu/) | official |
| 57 | [Mercury Weather](https://mercuryweather.app/) | consumer |
| 58 | [Met Eireann](https://www.met.ie/) | official |
| 59 | [Metcheck](https://www.metcheck.com/) | consumer |
| 60 | [Meteo Consult](https://www.meteoconsult.fr/) | consumer |
| 61 | [Meteo Madagascar](https://www.meteomadagascar.mg/) | official |
| 62 | [Meteo Rwanda](https://www.meteorwanda.gov.rw/) | official |
| 63 | [Meteo-France](https://meteofrance.com/) | official |
| 64 | [Meteo.it](https://www.meteo.it/) | consumer |
| 65 | [Meteo60](https://www.meteo60.fr/) | consumer |
| 66 | [MeteoAM](https://www.meteoam.it/) | consumer |
| 67 | [Meteoblue](https://www.meteoblue.com/) | consumer |
| 68 | [Meteobridge](https://www.meteobridge.com/) | station |
| 69 | [Meteociel](https://www.meteociel.fr/) | consumer |
| 70 | [Meteoprog](https://www.meteoprog.com/) | consumer |
| 71 | [Meteored](https://www.theweather.com/) | consumer |
| 72 | [MeteoSwiss](https://www.meteoswiss.admin.ch/) | official |
| 73 | [Mexico Servicio Meteorologico Nacional](https://smn.conagua.gob.mx/) | official |
| 74 | [Mountain Forecast](https://www.mountain-forecast.com/) | outdoor |
| 75 | [Mountain Weather Information Service](https://www.mwis.org.uk/) | outdoor |
| 76 | [MountainWeather](https://www.mountainweather.com/) | outdoor |
| 77 | [MSN Weather](https://www.msn.com/en-us/weather) | consumer |
| 78 | [MyRadar](https://myradar.com/) | consumer |
| 79 | [National Hurricane Center](https://www.nhc.noaa.gov/) | official |
| 80 | [National Weather Service](https://www.weather.gov/) | official |
| 81 | [Nepal Department of Hydrology and Meteorology](https://www.dhm.gov.np/) | official |
| 82 | [NOAA Weather Prediction Center](https://www.wpc.ncep.noaa.gov/) | official |
| 83 | [OnTheSnow](https://www.onthesnow.com/) | outdoor |
| 84 | [OpenSnow](https://opensnow.com/) | outdoor |
| 85 | [Pakistan Meteorological Department](https://www.pmd.gov.pk/) | official |
| 86 | [Papua New Guinea National Weather Service](https://www.pngmet.gov.pg/) | official |
| 87 | [Paraguay DMH](https://www.meteorologia.gov.py/) | official |
| 88 | [PassageWeather](https://www.passageweather.com/) | outdoor |
| 89 | [Peru SENAMHI](https://www.senamhi.gob.pe/) | official |
| 90 | [Philippines PAGASA](https://www.pagasa.dost.gov.ph/) | official |
| 91 | [Pluvia Weather](https://github.com/spicychair/pluvia_weather_flutter) | consumer |
| 92 | [PredictWind](https://www.predictwind.com/) | outdoor |
| 93 | [Prognoza](https://github.com/davidtakac/prognoza) | consumer |
| 94 | [PWS Weather](https://www.pwsweather.com/) | station |
| 95 | [Qatar Meteorology Department](https://www.caa.gov.qa/en/meteorology) | official |
| 96 | [RadarOmega](https://www.radaromega.com/) | consumer |
| 97 | [RadarScope](https://www.radarscope.app/) | consumer |
| 98 | [Rainbow Weather](https://rainbow.ai/) | consumer |
| 99 | [RainViewer](https://www.rainviewer.com/) | consumer |
| 100 | [RASP UK](https://rasp.stratus.org.uk/) | outdoor |
| 101 | [Romanian National Meteorological Administration](https://www.meteoromania.ro/) | official |
| 102 | [Royal Meteorological Institute Belgium](https://www.meteo.be/en/) | official |
| 103 | [Saudi National Center for Meteorology](https://ncm.gov.sa/) | official |
| 104 | [Seabreeze](https://www.seabreeze.com.au/) | outdoor |
| 105 | [SeaWeather](https://www.seaweather.net/) | outdoor |
| 106 | [Sensor.Community](https://sensor.community/en/) | air-quality |
| 107 | [SkySight](https://skysight.io/) | outdoor |
| 108 | [Slovak Hydrometeorological Institute](https://www.shmu.sk/) | official |
| 109 | [Slovenian ARSO](https://meteo.arso.gov.si/) | official |
| 110 | [Snow Forecast](https://www.snow-forecast.com/) | outdoor |
| 111 | [Solomon Islands Meteorological Service](https://www.met.gov.sb/) | official |
| 112 | [Spire Weather](https://spire.com/weather-climate/) | specialist |
| 113 | [Storm Prediction Center](https://www.spc.noaa.gov/) | official |
| 114 | [StormGeo](https://stormgeo.com/) | specialist |
| 115 | [Surf-Forecast](https://www.surf-forecast.com/) | outdoor |
| 116 | [Swedish Meteorological and Hydrological Institute](https://www.smhi.se/en) | official |
| 117 | [Swellinfo](https://www.swellinfo.com/) | outdoor |
| 118 | [Tanzania Meteorological Authority](https://www.meteo.go.tz/) | official |
| 119 | [Tempo Agora](https://www.tempoagora.com.br/) | consumer |
| 120 | [Thailand Meteorological Department](https://www.tmd.go.th/en/) | official |
| 121 | [The Weather Channel](https://weather.com/) | consumer |
| 122 | [The Weather Network](https://www.theweathernetwork.com/) | consumer |
| 123 | [Tide Forecast](https://www.tide-forecast.com/) | outdoor |
| 124 | [Tides4Fishing](https://tides4fishing.com/) | outdoor |
| 125 | [Tonga Meteorological Service](https://www.met.gov.to/) | official |
| 126 | [Tropical Tidbits](https://www.tropicaltidbits.com/) | specialist |
| 127 | [Tunisia Institut National de la Meteorologie](https://www.meteo.tn/) | official |
| 128 | [Turkish Meteorological Service](https://www.mgm.gov.tr/eng/forecast-cities.aspx) | official |
| 129 | [UK Met Office](https://www.metoffice.gov.uk/) | official |
| 130 | [UK Met Office WOW](https://wow.metoffice.gov.uk/) | station |
| 131 | [Uruguay INUMET](https://www.inumet.gub.uy/) | official |
| 132 | [US National Digital Forecast Database](https://digital.weather.gov/) | official |
| 133 | [Vanuatu Meteorology](https://www.vmgd.gov.vu/) | official |
| 134 | [Vietnam National Center for Hydrometeorological Forecasting](https://nchmf.gov.vn/) | official |
| 135 | [Weather and Radar](https://www.weatherandradar.com/) | consumer |
| 136 | [Weather Display](https://www.weather-display.com/) | station |
| 137 | [Weather Underground](https://www.wunderground.com/) | consumer |
| 138 | [Weather-forecast.com](https://www.weather-forecast.com/) | consumer |
| 139 | [Weather.com.au](https://www.weather.com.au/) | consumer |
| 140 | [WeatherBell](https://www.weatherbell.com/) | specialist |
| 141 | [WeatherBug](https://www.weatherbug.com/) | consumer |
| 142 | [Weathercloud](https://weathercloud.net/) | station |
| 143 | [WeatherFlow Tempest](https://tempest.earth/) | station |
| 144 | [Weathergraph](https://weathergraph.app/) | consumer |
| 145 | [WeatherMaster](https://github.com/PranshulGG/WeatherMaster) | consumer |
| 146 | [Weathernews](https://weathernews.jp/) | consumer |
| 147 | [WeatherOnline](https://www.weatheronline.co.uk/) | consumer |
| 148 | [WeatherSTEM](https://www.weatherstem.com/) | station |
| 149 | [WeatherTAP](https://www.weathertap.com/) | specialist |
| 150 | [Weatherzone](https://www.weatherzone.com.au/) | consumer |
| 151 | [Weawow](https://weawow.com/) | consumer |
| 152 | [Weeronline](https://www.weeronline.nl/) | consumer |
| 153 | [Weerplaza](https://www.weerplaza.nl/) | consumer |
| 154 | [WeeWX](https://weewx.com/) | station |
| 155 | [Wetter.com](https://www.wetter.com/) | consumer |
| 156 | [Wetter.de](https://www.wetter.de/) | consumer |
| 157 | [Wetter24](https://www.wetter24.de/) | consumer |
| 158 | [Wetterzentrale](https://www.wetterzentrale.de/) | specialist |
| 159 | [WillyWeather](https://www.willyweather.com/) | consumer |
| 160 | [WindAlert](https://www.windalert.com/) | outdoor |
| 161 | [WindBorne WeatherMesh](https://windbornesystems.com/) | specialist |
| 162 | [Windguru](https://www.windguru.cz/) | outdoor |
| 163 | [Windy.app](https://windy.app/) | outdoor |
| 164 | [World Air Quality Index](https://waqi.info/) | air-quality |
| 165 | [XC Skies](https://www.xcskies.com/) | outdoor |
| 166 | [XCWeather](https://www.xcweather.co.uk/) | outdoor |
| 167 | [XyGrib](https://opengribs.org/) | outdoor |
| 168 | [Yr](https://www.yr.no/en) | consumer |
| 169 | [Zoom Earth](https://zoom.earth/) | specialist |
