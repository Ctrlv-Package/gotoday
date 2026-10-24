import type {EventSource} from "./types";
import {buildFetcher} from "./platforms";
import {db} from "../db";
import {ensureSchema} from "../schema";

// Source list. These are SEEDS: on first run they're copied into the source_configs table, and from
// then on the database is the source of truth (add/edit/disable sources via /api/admin/sources
// without deploying). Preferred source order: JSON API > RSS/ICS > HTML.
export type SourceConfig={name:string;platform:string;params:Record<string,any>;source_type?:string;url?:string;priority?:number;region?:string;timezone?:string;enabled?:boolean;remote?:boolean};

const civic=(name:string,site:string,city:string,region:string):SourceConfig=>({name,platform:"civicplus",remote:true,params:{site,city,idPrefix:city.split(",")[0].toLowerCase().replace(/[^a-z]/g,"")},source_type:"official-city",url:site+"/Calendar.aspx",priority:100,region});
// Granicus OpenCities city sites block cloud servers, so they're fetched by the GitHub remote job.
const oc=(name:string,listUrl:string,city:string,idPrefix:string,region:string):SourceConfig=>({name,platform:"opencities",remote:true,params:{listUrl,city,venue:city.split(",")[0],idPrefix,maxPages:15},source_type:"official-city",url:listUrl,priority:100,region});
// Official town, parks and public-venue Instagram accounts (read through Instagram's Business Discovery API).
// A handle that doesn't resolve pauses itself on its first run. Name suffix keeps them apart from calendar sources.
const ig=(name:string,city:string,username:string,region:string):SourceConfig=>({name:`${name} · Instagram`,platform:"instagram",params:{username,city,venue:name,idPrefix:`ig-${username.replace(/[^a-z0-9]/gi,"").toLowerCase()}`},source_type:"venue",url:`https://www.instagram.com/${username}/`,priority:80,region});
const INSTAGRAM_ACCOUNTS:SourceConfig[]=[
 ig("NoBe Sunday","Fort Lauderdale, FL","nobesunday","broward"),
 ig("St. Paul Lutheran Church & Pre-School","Weston, FL","stpaulweston","broward"),
 ig("City of Weston","Weston, FL","cityofwestonfl","broward"),
 ig("City of Sunrise","Sunrise, FL","cityofsunrise","broward"),
 ig("City of Plantation","Plantation, FL","cityofplantation","broward"),
 ig("Plantation Parks & Rec","Plantation, FL","plantationparks","broward"),
 ig("City of Fort Lauderdale","Fort Lauderdale, FL","cityoffortlauderdale","broward"),
 ig("Fort Lauderdale Parks & Rec","Fort Lauderdale, FL","playlauderdale","broward"),
 ig("City of Coral Springs","Coral Springs, FL","coralspringsfl","broward"),
 ig("Coral Springs Parks & Rec","Coral Springs, FL","playcoralsprings","broward"),
 ig("City of Miramar","Miramar, FL","cityofmiramar","broward"),
 ig("Miramar Parks","Miramar, FL","miramarparks","broward"),
 ig("City of Hollywood","Hollywood, FL","cityofhollywoodfl","broward"),
 ig("Hollywood Parks & Rec","Hollywood, FL","hollywoodflparksandrec","broward"),
 ig("City of Pembroke Pines","Pembroke Pines, FL","cityofppines","broward"),
 ig("City of Parkland","Parkland, FL","cityofparkland","broward"),
 ig("City of Hallandale Beach","Hallandale Beach, FL","myhbeach","broward"),
 ig("Hallandale Beach Parks & Rec","Hallandale Beach, FL","hbparksrec","broward"),
 ig("Town of Davie","Davie, FL","townofdavie","broward"),
 ig("Davie Parks & Rec","Davie, FL","davieparksrec","broward"),
 ig("City of Margate","Margate, FL","cityofmargatefl","broward"),
 ig("City of Deerfield Beach","Deerfield Beach, FL","cityofdeerfieldbeach","broward"),
 ig("City of Cooper City","Cooper City, FL","coopercitygov","broward"),
 ig("City of Coconut Creek","Coconut Creek, FL","coconutcreekgov","broward"),
 ig("Coconut Creek Parks & Rec","Coconut Creek, FL","coconutcreekrec","broward"),
 ig("City of Tamarac","Tamarac, FL","cityoftamarac","broward"),
 ig("City of Lauderhill","Lauderhill, FL","cityoflauderhill","broward"),
 ig("City of Pompano Beach","Pompano Beach, FL","cityofpompanobeach","broward"),
 ig("Pompano Beach Parks & Rec","Pompano Beach, FL","pompanobeachparks","broward"),
 ig("City of Lauderdale Lakes","Lauderdale Lakes, FL","lauderdalelakesfl","broward"),
 ig("City of Wilton Manors","Wilton Manors, FL","wiltonmanorsofficial","broward"),
 ig("City of Oakland Park","Oakland Park, FL","cityoaklandpark","broward"),
 ig("Oakland Park Events","Oakland Park, FL","oaklandparkevents","broward"),
 ig("City of Lighthouse Point","Lighthouse Point, FL","cityoflighthousepointfl","broward"),
 ig("City of Dania Beach","Dania Beach, FL","daniabeachfl","broward"),
 ig("Town of Southwest Ranches","Southwest Ranches, FL","townofswr","broward"),
 ig("Broward County Parks","Fort Lauderdale, FL","browardparks","broward"),
 ig("Las Olas Boulevard","Fort Lauderdale, FL","lasolasblvd","broward"),
 ig("Riverwalk Fort Lauderdale","Fort Lauderdale, FL","riverwalkftl","broward"),
 ig("Downtown Fort Lauderdale","Fort Lauderdale, FL","fortlauderdaledowntown","broward"),
 ig("ArtsPark at Young Circle","Hollywood, FL","hollywoodartspark","broward"),
 ig("Downtown Hollywood","Hollywood, FL","hollywooddowntownfl","broward"),
 ig("The Village at Gulfstream Park","Hallandale Beach, FL","gulfstreamvillage","broward"),
 ig("Charles F. Dodge City Center","Pembroke Pines, FL","charlesfdodgecenter","broward"),
 ig("Miramar Cultural Center","Miramar, FL","miramarcultural","broward"),
 ig("Sawgrass Mills","Sunrise, FL","shopsawgrass","broward"),
 ig("Promenade at Coconut Creek","Coconut Creek, FL","promenadecc","broward"),
 ig("Lauderdale-By-The-Sea","Lauderdale-By-The-Sea, FL","discoverlbts","broward"),
 ig("City of Miami","Miami, FL","cityofmiami","miami-dade"),
 ig("Miami Parks","Miami, FL","miamiparks","miami-dade"),
 ig("Bayfront Park","Miami, FL","bayfrontparkmia","miami-dade"),
 ig("City of Miami Beach","Miami Beach, FL","miamibeachnews","miami-dade"),
 ig("City of Coral Gables","Coral Gables, FL","cityofcoralgables","miami-dade"),
 ig("Coral Gables Parks & Rec","Coral Gables, FL","gablesparks","miami-dade"),
 ig("City of Doral","Doral, FL","cityofdoral","miami-dade"),
 ig("CityPlace Doral","Doral, FL","cityplacedoral","miami-dade"),
 ig("Downtown Doral","Doral, FL","downtowndoral","miami-dade"),
 ig("City of Hialeah","Hialeah, FL","cityofhialeah","miami-dade"),
 ig("Hialeah Parks & Rec","Hialeah, FL","hialeahparksandrec","miami-dade"),
 ig("City of Homestead","Homestead, FL","cityofhomestead","miami-dade"),
 ig("City of Aventura","Aventura, FL","cityofaventura","miami-dade"),
 ig("Aventura Parks","Aventura, FL","aventuraparks","miami-dade"),
 ig("City of North Miami","North Miami, FL","northmiamifl","miami-dade"),
 ig("City of North Miami Beach","North Miami Beach, FL","citynmb","miami-dade"),
 ig("North Miami Beach Parks & Rec","North Miami Beach, FL","nmbparksrec","miami-dade"),
 ig("City of Miami Gardens","Miami Gardens, FL","cityofmiamigardens","miami-dade"),
 ig("Village of Pinecrest","Pinecrest, FL","pinecrestfl","miami-dade"),
 ig("Pinecrest Parks & Rec","Pinecrest, FL","pinecrestparks","miami-dade"),
 ig("Town of Cutler Bay","Cutler Bay, FL","townofcutlerbay","miami-dade"),
 ig("Village of Palmetto Bay","Palmetto Bay, FL","villageofpalmettobay","miami-dade"),
 ig("Town of Miami Lakes","Miami Lakes, FL","town_of_miami_lakes","miami-dade"),
 ig("City of Sunny Isles Beach","Sunny Isles Beach, FL","cityofsib","miami-dade"),
 ig("Village of Key Biscayne","Key Biscayne, FL","villageofkeybiscayne","miami-dade"),
 ig("Key Biscayne Community Center","Key Biscayne, FL","keybiscaynecommunitycenter","miami-dade"),
 ig("City of Miami Springs","Miami Springs, FL","cityofmiamisprings","miami-dade"),
 ig("Miami Springs Parks & Rec","Miami Springs, FL","miamispringsparksandrecreation","miami-dade"),
 ig("City of South Miami","South Miami, FL","somiamigov","miami-dade"),
 ig("Town of Surfside","Surfside, FL","surfsideflorida","miami-dade"),
 ig("Miami-Dade Parks","Miami, FL","miamidadeparks","miami-dade"),
 ig("City of Boca Raton","Boca Raton, FL","citybocaraton","palm-beach"),
 ig("Boca Raton Recreation","Boca Raton, FL","bocarecreation","palm-beach"),
 ig("Mizner Park","Boca Raton, FL","miznerpark","palm-beach"),
 ig("Mizner Park Amphitheater","Boca Raton, FL","miznerparkamp","palm-beach"),
 ig("Downtown Boca","Boca Raton, FL","downtownboca","palm-beach"),
 ig("City of Delray Beach","Delray Beach, FL","cityofdelraybeachfl","palm-beach"),
 ig("Delray Beach Parks & Rec","Delray Beach, FL","delraybeachparksnrec","palm-beach"),
 ig("Downtown Delray Beach","Delray Beach, FL","downtowndelray","palm-beach"),
 ig("City of Boynton Beach","Boynton Beach, FL","cityofboyntonbeach","palm-beach"),
 ig("Boynton Beach Recreation","Boynton Beach, FL","boyntonbeachrec","palm-beach"),
 ig("City of West Palm Beach","West Palm Beach, FL","thecityofwpb","palm-beach"),
 ig("West Palm Beach Events","West Palm Beach, FL","eventswpb","palm-beach"),
 ig("CityPlace West Palm","West Palm Beach, FL","cityplacewestpalm","palm-beach"),
 ig("Village of Wellington","Wellington, FL","wellingtonflgov","palm-beach"),
 ig("Wellington Parks & Rec","Wellington, FL","wellingtonflrec","palm-beach"),
 ig("Thursday Nights in Wellington","Wellington, FL","thursdaynightsinwellington","palm-beach"),
 ig("Town of Jupiter","Jupiter, FL","townofjupiterfl","palm-beach"),
 ig("City of Palm Beach Gardens","Palm Beach Gardens, FL","cityofpbg","palm-beach"),
 ig("Village of Royal Palm Beach","Royal Palm Beach, FL","villageroyalpalmbeach","palm-beach"),
 ig("City of Lake Worth Beach","Lake Worth Beach, FL","lakeworthbeachpbc","palm-beach"),
 ig("Lake Worth Beach City Library","Lake Worth Beach, FL","lwbcitylibrary","palm-beach"),
 ig("City of Greenacres","Greenacres, FL","cityofgreenacres","palm-beach"),
 ig("Town of Lantana","Lantana, FL","townoflantana","palm-beach"),
 ig("Palm Beach County Parks","West Palm Beach, FL","pbcparks","palm-beach"),
 ig("City of Orlando","Orlando, FL","thecitybeautiful","orlando"),
 ig("Orlando Parks & Rec","Orlando, FL","orlandofpr","orlando"),
 ig("Downtown Orlando","Orlando, FL","dwntwn_orlando","orlando"),
 ig("City of Winter Park","Winter Park, FL","winterparkfla","orlando"),
 ig("Winter Park Parks & Rec","Winter Park, FL","parksandrecwp","orlando"),
 ig("Winter Park Events Center","Winter Park, FL","winterparkeventscenter","orlando"),
 ig("Winter Park Farmers Market","Winter Park, FL","farmersmarketwinterpark","orlando"),
 ig("City of Kissimmee","Kissimmee, FL","cityofkissimmee","orlando"),
 ig("City of Sanford","Sanford, FL","cityofsanfordfl","orlando"),
 ig("Historic Downtown Sanford","Sanford, FL","historicdowntownsanford","orlando"),
 ig("City of Altamonte Springs","Altamonte Springs, FL","cityofaltamontesprings","orlando"),
 ig("Downtown Winter Garden","Winter Garden, FL","officialdowntownwintergarden","orlando"),
 ig("City of Apopka","Apopka, FL","cityofapopka","orlando"),
 ig("City of Ocoee","Ocoee, FL","cityofocoee","orlando"),
 ig("City of Lake Mary","Lake Mary, FL","cityoflakemary","orlando"),
 ig("Lake Mary Events Center","Lake Mary, FL","lakemaryeventscenter","orlando"),
 ig("Orange County Regional History Center","Orlando, FL","historycenterfl","orlando"),
 ig("City of Tampa","Tampa, FL","cityoftampa","tampa"),
 ig("Tampa Parks & Rec","Tampa, FL","tampaparksrec","tampa"),
 ig("Tampa Riverwalk","Tampa, FL","tampa_riverwalk","tampa"),
 ig("Curtis Hixon Waterfront Park","Tampa, FL","curtishixonpark","tampa"),
 ig("City of St. Petersburg","St. Petersburg, FL","stpetefl","tampa"),
 ig("St. Pete Parks & Rec","St. Petersburg, FL","stpeteparksrec","tampa"),
 ig("St. Pete Pier","St. Petersburg, FL","stpetepier","tampa"),
 ig("City of Clearwater","Clearwater, FL","myclearwater","tampa"),
 ig("City of Largo","Largo, FL","cityoflargo","tampa"),
 ig("Largo Recreation","Largo, FL","largorec","tampa"),
 ig("City of Temple Terrace","Temple Terrace, FL","cityoftempleterrace","tampa"),
 ig("Temple Terrace Parks & Rec","Temple Terrace, FL","ttleisureservices","tampa"),
 ig("City of Dunedin","Dunedin, FL","cityofdunedin","tampa"),
 ig("City of Pinellas Park","Pinellas Park, FL","cityofpinellaspark","tampa"),
 ig("City of Oldsmar","Oldsmar, FL","oldsmarflorida","tampa"),
 ig("City of Safety Harbor","Safety Harbor, FL","cityofsafetyharbor","tampa"),
 // Community round-up accounts (not official): lower priority, so an official listing of the same event wins.
 {...ig("Miami Residents","Miami, FL","miami_residents","miami-dade"),source_type:"roundup",priority:70},
 {...ig("Weekend Broward","Fort Lauderdale, FL","weekendbroward","broward"),source_type:"roundup",priority:70},
 {...ig("The Broward Scene","Fort Lauderdale, FL","thebrowardscene","broward"),source_type:"roundup",priority:70},
 {...ig("To Do with Kids Broward","Fort Lauderdale, FL","todowithkidsbroward","broward"),source_type:"roundup",priority:70},
 {...ig("To Do with Kids Miami","Miami, FL","todowithkidsmiami","miami-dade"),source_type:"roundup",priority:70}
];
export const SEED_SOURCES:SourceConfig[]=[
 // ---- Broward ----
 civic("City of Hollywood","https://www.hollywoodfl.org","Hollywood, FL","broward"),
 {...civic("City of Pembroke Pines","https://www.ppines.com","Pembroke Pines, FL","broward"),params:{site:"https://www.ppines.com",city:"Pembroke Pines, FL",idPrefix:"ppines"}},
 civic("City of Parkland","https://www.cityofparkland.org","Parkland, FL","broward"),
 {...civic("City of Hallandale Beach","https://www.cohb.org","Hallandale Beach, FL","broward"),params:{site:"https://www.cohb.org",city:"Hallandale Beach, FL",idPrefix:"hallandale"}},
 {...civic("Town of Davie","https://www.davie-fl.gov","Davie, FL","broward"),params:{site:"https://www.davie-fl.gov",city:"Davie, FL",idPrefix:"davie"}},
 civic("City of Margate","https://www.margatefl.com","Margate, FL","broward"),
 civic("City of Tamarac","https://www.tamarac.gov","Tamarac, FL","broward"),   // city calendar (parks & rec events live here)
 {...civic("City of Deerfield Beach","https://www.deerfield-beach.com","Deerfield Beach, FL","broward"),params:{site:"https://www.deerfield-beach.com",city:"Deerfield Beach, FL",idPrefix:"deerfield"}},
 {name:"City of Cooper City",platform:"thrillshare",params:{orgId:30103,city:"Cooper City, FL",site:"https://www.coopercity.gov",idPrefix:"coopercity"},url:"https://www.coopercity.gov/events",priority:100,region:"broward"},
 {name:"City of Weston",platform:"govaccess",remote:true,params:{site:"https://www.westonfl.org",city:"Weston, FL",idPrefix:"weston",tilePages:["/government/parks-and-recreation/special-events"],calendarPaths:["/about/events-calendar"]},url:"https://www.westonfl.org/about/events-calendar",priority:100,region:"broward"},
 {name:"City of Sunrise",platform:"govaccess",remote:true,params:{site:"https://www.sunrisefl.gov",city:"Sunrise, FL",idPrefix:"sunrise",tilePages:["/departments-services/leisure-services/events"],calendarPaths:["/our-city/calendar-of-events"]},url:"https://www.sunrisefl.gov/our-city/calendar-of-events",priority:100,region:"broward"},
 {name:"City of Plantation",platform:"govaccess",remote:true,params:{site:"https://www.plantation.org",city:"Plantation, FL",idPrefix:"plantation",tilePages:["/government/departments/parks-recreation/events","/government/departments/parks-recreation/events/-toggle-next30days"]},url:"https://www.plantation.org/government/departments/parks-recreation/events",priority:100,region:"broward"},
 oc("City of Coral Springs","https://www.coralsprings.gov/Events-directory","Coral Springs, FL","coralsprings","broward"),
 oc("City of Miramar","https://www.miramarfl.gov/Events","Miramar, FL","miramar","broward"),
 {name:"City of Fort Lauderdale",platform:"opencities",remote:true,params:{listUrl:"https://www.fortlauderdale.gov/Explore-FTL/Event-Calendar",eventPath:"/Explore-FTL/Event-Calendar",city:"Fort Lauderdale, FL",venue:"Fort Lauderdale",idPrefix:"ftl",
  pageUrlTemplate:"https://www.fortlauderdale.gov/Explore-FTL/Event-Calendar?dlv_OC%20CL%20Public%20Events%20Listing=(pageindex={n})",block:"\\b(board|commission|committee|advisory|meeting|hearing|webinar|king tides|hazardous waste|waste|drop-off|certificate of use|bargaining session|magistrate|development review|code enforcement)\\b"},url:"https://www.fortlauderdale.gov/Explore-FTL/Event-Calendar",priority:100,region:"broward"},
 {name:"Weston Town Center",platform:"instagram",params:{username:"westontowncenter",city:"Weston, FL",venue:"Weston Town Center",address:"1675 Market St, Weston, FL 33326",idPrefix:"wtc"},source_type:"venue",url:"https://www.instagram.com/westontowncenter/",priority:95,region:"broward"},
 {name:"Broward County Library",platform:"communico",params:{client:"broward",idPrefix:"bcl",defaultVenue:"Broward County Library",cityMap:"broward"},source_type:"official-county",url:"https://broward.libnet.info/events",priority:98,region:"broward"},
 {name:"Broward County Parks",platform:"broward-parks",remote:true,params:{},source_type:"official-county",url:"https://www.broward.org/parks/Events",priority:98,region:"broward"},
 {name:"Riverwalk Fort Lauderdale",platform:"riverwalk",params:{},source_type:"local-aggregator",url:"https://www.goriverwalk.com/events/greater-fort-lauderdale-event-calendar",priority:85,region:"broward"},
 // ---- Miami-Dade / Palm Beach ----
 {name:"Miami-Dade Public Library",platform:"communico",params:{client:"mdpls",idPrefix:"mdpl",defaultVenue:"Miami-Dade Public Library",cityMap:"miami-dade",siteUrl:"https://mdpls.org"},source_type:"official-county",url:"https://mdpls.org/events",priority:90,region:"miami-dade"},
 {name:"Palm Beach County Library",platform:"bibliocommons",params:{library:"pbclibrary",idPrefix:"pbcl",defaultCity:"Palm Beach County, FL",defaultVenue:"Palm Beach County Library"},source_type:"official-county",url:"https://pbclibrary.bibliocommons.com/v2/events",priority:90,region:"palm-beach"},
 {name:"North Miami Beach Public Library",platform:"communico",params:{client:"nmblib",idPrefix:"nmbl",defaultVenue:"North Miami Beach Public Library",defaultCity:"North Miami Beach, FL"},source_type:"official-city",url:"https://nmblib.libnet.info/events",priority:90,region:"miami-dade"},
 oc("City of Doral","https://www.cityofdoral.com/Events-directory","Doral, FL","doral","miami-dade"),
 oc("City of Sunny Isles Beach","https://www.sibfl.gov/Parks-Recreation/Events/Event-Calendar","Sunny Isles Beach, FL","sib","miami-dade"),
 {name:"Boca Raton Public Library",platform:"libcal",params:{site:"bocalibrary",idPrefix:"brpl",defaultVenue:"Boca Raton Public Library",defaultCity:"Boca Raton, FL"},source_type:"official-city",url:"https://bocalibrary.libcal.com/calendar",priority:90,region:"palm-beach"},
 // ---- Orlando area ----
 oc("City of Orlando","https://www.orlando.gov/Events","Orlando, FL","orlando","orlando"),
 oc("City of Kissimmee","https://www.kissimmee.gov/Events-directory","Kissimmee, FL","kissimmee","orlando"),
 {name:"Orange County Library System",platform:"communico",params:{client:"ocls",baseUrl:"https://attend.ocls.org",siteUrl:"https://attend.ocls.org",idPrefix:"ocls",defaultVenue:"Orange County Library System",defaultCity:"Orlando, FL",
  branchCities:[["winter garden","Winter Garden, FL"],["north orange","Apopka, FL"],["west oaks","Ocoee, FL"],["windermere","Windermere, FL"],["eatonville","Eatonville, FL"]]},source_type:"official-county",url:"https://attend.ocls.org/events",priority:90,region:"orlando"},
 {name:"Osceola Library System",platform:"libcal",params:{site:"osceolalibrary",idPrefix:"osceola",defaultVenue:"Osceola Library System",defaultCity:"Kissimmee, FL",
  branchCities:[["st\\.? ?cloud","St. Cloud, FL"],["poinciana","Poinciana, FL"],["west osceola|celebration","Celebration, FL"],["kenansville","Kenansville, FL"]]},source_type:"official-county",url:"https://osceolalibrary.libcal.com/calendar",priority:90,region:"orlando"},
 // ---- Tampa Bay ----
 oc("City of Clearwater","https://www.myclearwater.com/Events-and-Meetings","Clearwater, FL","clearwater","tampa"),
 {name:"Tampa-Hillsborough County Public Library",platform:"communico",params:{client:"hcplc",baseUrl:"https://attend.hcplc.org",idPrefix:"hcplc",defaultVenue:"Tampa-Hillsborough County Public Library",defaultCity:"Tampa, FL",
  branchCities:[["brandon","Brandon, FL"],["riverview","Riverview, FL"],["southshore|ruskin","Ruskin, FL"],["lutz","Lutz, FL"],["seffner","Seffner, FL"],["thonotosassa","Thonotosassa, FL"],["bruton|plant city","Plant City, FL"],["temple terrace","Temple Terrace, FL"],["bloomingdale","Valrico, FL"],["austin davis","Odessa, FL"],["apollo beach","Apollo Beach, FL"],["sun city","Sun City Center, FL"],["gibsonton","Gibsonton, FL"]]},source_type:"official-county",url:"https://attend.hcplc.org/events",priority:90,region:"tampa"},
 {name:"St. Petersburg Public Library",platform:"libcal",params:{site:"splibraries",idPrefix:"sppl",defaultVenue:"St. Petersburg Public Library",defaultCity:"St. Petersburg, FL"},source_type:"official-city",url:"https://splibraries.libcal.com/calendar",priority:90,region:"tampa"},
 // ---- Ticketed (supplemental) ----
 {name:"Ticketmaster",platform:"ticketmaster",params:{marketId:"15",label:"South Florida"},source_type:"ticketing",url:"https://www.ticketmaster.com",priority:60,region:"south-florida"},
 {name:"Ticketmaster Orlando",platform:"ticketmaster",params:{latlong:"28.5383,-81.3792",radius:35,label:"Orlando"},source_type:"ticketing",url:"https://www.ticketmaster.com",priority:60,region:"orlando"},
 // ---- New York City ----
 {name:"NYC Parks",platform:"nyc-parks",params:{},source_type:"official-city",url:"https://www.nycgovparks.org/events",priority:98,region:"nyc"},
 {name:"Ticketmaster New York",platform:"ticketmaster",params:{latlong:"40.7306,-73.9866",radius:15,label:"New York City"},source_type:"ticketing",url:"https://www.ticketmaster.com",priority:60,region:"nyc"},
 {name:"Ticketmaster Tampa Bay",platform:"ticketmaster",params:{latlong:"27.9506,-82.4572",radius:35,label:"Tampa Bay"},source_type:"ticketing",url:"https://www.ticketmaster.com",priority:60,region:"tampa"},
 {name:"Ticketmaster Jacksonville",platform:"ticketmaster",params:{latlong:"30.3322,-81.6557",radius:35,label:"Jacksonville"},source_type:"ticketing",url:"https://www.ticketmaster.com",priority:60,region:"jacksonville"},
 {name:"Ticketmaster Daytona Beach",platform:"ticketmaster",params:{latlong:"29.2108,-81.0228",radius:30,label:"Daytona Beach"},source_type:"ticketing",url:"https://www.ticketmaster.com",priority:60,region:"volusia"},
 {name:"Ticketmaster Space Coast",platform:"ticketmaster",params:{latlong:"28.2639,-80.7214",radius:30,label:"Space Coast"},source_type:"ticketing",url:"https://www.ticketmaster.com",priority:60,region:"spacecoast"},
 {name:"Ticketmaster Treasure Coast",platform:"ticketmaster",params:{latlong:"27.2730,-80.3582",radius:30,label:"Treasure Coast"},source_type:"ticketing",url:"https://www.ticketmaster.com",priority:60,region:"treasurecoast"},
 {name:"Ticketmaster Sarasota",platform:"ticketmaster",params:{latlong:"27.3364,-82.5307",radius:30,label:"Sarasota"},source_type:"ticketing",url:"https://www.ticketmaster.com",priority:60,region:"sarasota"},
 {name:"Ticketmaster Fort Myers & Naples",platform:"ticketmaster",params:{latlong:"26.4,-81.85",radius:35,label:"Fort Myers & Naples"},source_type:"ticketing",url:"https://www.ticketmaster.com",priority:60,region:"swfl"},
 {name:"Ticketmaster Lakeland",platform:"ticketmaster",params:{latlong:"28.0395,-81.9498",radius:25,label:"Lakeland"},source_type:"ticketing",url:"https://www.ticketmaster.com",priority:60,region:"polk"},
 {name:"Ticketmaster Gainesville & Ocala",platform:"ticketmaster",params:{latlong:"29.4,-82.2",radius:35,label:"Gainesville & Ocala"},source_type:"ticketing",url:"https://www.ticketmaster.com",priority:60,region:"gainesville"},
 {name:"Ticketmaster Tallahassee",platform:"ticketmaster",params:{latlong:"30.4383,-84.2807",radius:30,label:"Tallahassee"},source_type:"ticketing",url:"https://www.ticketmaster.com",priority:60,region:"tallahassee"},
 {name:"Ticketmaster Pensacola & Emerald Coast",platform:"ticketmaster",params:{latlong:"30.45,-86.9",radius:45,label:"Pensacola & Emerald Coast"},source_type:"ticketing",url:"https://www.ticketmaster.com",priority:60,region:"panhandle",timezone:"America/Chicago"},
 {name:"Ticketmaster Panama City",platform:"ticketmaster",params:{latlong:"30.1588,-85.6602",radius:30,label:"Panama City"},source_type:"ticketing",url:"https://www.ticketmaster.com",priority:60,region:"panhandle",timezone:"America/Chicago"},
 {name:"Ticketmaster Key West",platform:"ticketmaster",params:{latlong:"24.5551,-81.78",radius:60,label:"Key West"},source_type:"ticketing",url:"https://www.ticketmaster.com",priority:60,region:"keys"},

 ...INSTAGRAM_ACCOUNTS,
];

function toSource(c:SourceConfig):EventSource{
 return{name:c.name,type:c.source_type||"official-city",url:c.url||"",priority:c.priority??90,enabled:c.enabled!==false,remote:!!c.remote,timezone:c.timezone||"America/New_York",region:c.region,platform:c.platform,
  fetch:(s,e)=>buildFetcher(c.platform,c.params,{name:c.name})(s,e)};
}

/** Load source configs from the database, seeding any code seeds it doesn't have yet. */
export async function loadSourceConfigs():Promise<SourceConfig[]>{
 await ensureSchema();
 for(const c of SEED_SOURCES){
  await db.query(`insert into source_configs(name,platform,params,source_type,url,priority,region,timezone,enabled,remote) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(name) do nothing`,
   [c.name,c.platform,JSON.stringify(c.params||{}),c.source_type||"official-city",c.url||null,c.priority??90,c.region||null,c.timezone||"America/New_York",c.enabled!==false,!!c.remote]);
 }
 const {rows}=await db.query("select * from source_configs order by priority desc,name");
 return dedupeCalendars(rows.map((r:any)=>({name:r.name,platform:r.platform,params:r.params||{},source_type:r.source_type,url:r.url,priority:r.priority,region:r.region,timezone:r.timezone,enabled:r.enabled,remote:r.remote})));
}
/** One calendar saved under two names (a county site and its library page both lead to the same LibCal) is fetched
 *  once: the copy is switched off. For library platforms the name with "Library" in it is kept. */
export function dedupeCalendars(list:SourceConfig[]):SourceConfig[]{
 const sig=(c:SourceConfig)=>`${c.platform}:${JSON.stringify(Object.entries(c.params||{}).filter(([k])=>!/^(default(City|Venue)|city|venue|branchCities|label|idPrefix)$/.test(k)).sort())}`;
 const lib=(c:SourceConfig)=>/^(libcal|communico|bibliocommons)$/.test(c.platform)&&/librar/i.test(c.name)?1:0;
 const keep=new Map<string,SourceConfig>();
 for(const c of list){if(c.enabled===false)continue;const k=sig(c),o=keep.get(k);if(!o||lib(c)>lib(o))keep.set(k,c)}
 return list.map(c=>c.enabled!==false&&keep.get(sig(c))!==c?{...c,enabled:false}:c);
}
export async function allSources(){return(await loadSourceConfigs()).map(toSource)}
/** Sources ingested on Vercel. */
export async function activeSources(){return(await allSources()).filter(s=>s.enabled!==false&&!s.remote)}
/** Sources fetched outside Vercel (city sites that block cloud servers). */
export async function remoteSources(){return(await allSources()).filter(s=>s.enabled!==false&&s.remote)}
export const sourceFromConfig=toSource;
export async function sourcePriority(name:string){return(await allSources()).find(s=>s.name===name)?.priority??40}
