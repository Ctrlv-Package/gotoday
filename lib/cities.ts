// City centres and helpers shared by the events API and the /today/[city]
// landing pages. Extracted from app/api/events/route.ts (2026-10-20, #5) so
// there is one list of places GoToday knows, not a copy per feature.
export const CITY_COORDS:Record<string,[number,number]>={
"Sunrise, FL":[26.16697,-80.25659],"Pembroke Pines, FL":[26.00777,-80.29626],"Hollywood, FL":[26.0112,-80.14949],
"Fort Lauderdale, FL":[26.12231,-80.14338],"Davie, FL":[26.06287,-80.2331],"Weston, FL":[26.10037,-80.39977],
"Miramar, FL":[25.98731,-80.23227],"Coconut Creek, FL":[26.25175,-80.17894],"Hallandale Beach, FL":[25.9812,-80.14838],
"Pompano Beach, FL":[26.23786,-80.12477],"Coral Springs, FL":[26.27119,-80.2706],"Plantation, FL":[26.12759,-80.2331],
"Lauderhill, FL":[26.1404,-80.2134],"Lauderdale Lakes, FL":[26.1664,-80.2084],"Dania Beach, FL":[26.0523,-80.1439],
"Tamarac, FL":[26.2129,-80.2498],"Margate, FL":[26.2445,-80.2064],"Deerfield Beach, FL":[26.3184,-80.0998],
"Oakland Park, FL":[26.1723,-80.132],"Lighthouse Point, FL":[26.2756,-80.0873],"Cooper City, FL":[26.0573,-80.2717],
"West Park, FL":[25.9845,-80.1987],"North Lauderdale, FL":[26.2173,-80.2259],"Wilton Manors, FL":[26.1604,-80.1389],
"Parkland, FL":[26.3101,-80.2373],"Southwest Ranches, FL":[26.0587,-80.3373],"Lauderdale-By-The-Sea, FL":[26.192,-80.0964],
"Hillsboro Beach, FL":[26.2995,-80.0784],"Pembroke Park, FL":[25.9879,-80.1773],"Sea Ranch Lakes, FL":[26.2003,-80.0937],"Broward County, FL":[26.1224,-80.2],
"Miami, FL":[25.7617,-80.1918],"Miami Beach, FL":[25.7907,-80.13],"North Miami, FL":[25.8901,-80.1867],"North Miami Beach, FL":[25.9331,-80.1625],
"Coral Gables, FL":[25.7215,-80.2684],"Hialeah, FL":[25.8576,-80.2781],"Homestead, FL":[25.4687,-80.4776],"Doral, FL":[25.8195,-80.3553],
"Miami Springs, FL":[25.8223,-80.2895],"Miami Lakes, FL":[25.9087,-80.3087],"Opa-locka, FL":[25.9023,-80.2503],"Key Biscayne, FL":[25.6937,-80.1628],
"Aventura, FL":[25.9565,-80.1392],"Sunny Isles Beach, FL":[25.9429,-80.1234],"Pinecrest, FL":[25.6671,-80.3081],"Cutler Bay, FL":[25.5808,-80.3468],
"Miami Gardens, FL":[25.942,-80.2456],"Sweetwater, FL":[25.7634,-80.3731],"Kendall, FL":[25.6793,-80.3173],
"West Palm Beach, FL":[26.7153,-80.0534],"Lake Worth, FL":[26.6168,-80.0684],"Lake Worth Beach, FL":[26.6168,-80.0556],"Boca Raton, FL":[26.3683,-80.1289],
"Delray Beach, FL":[26.4615,-80.0728],"Boynton Beach, FL":[26.5318,-80.0905],"Wellington, FL":[26.6618,-80.2684],"Jupiter, FL":[26.9342,-80.0942],
"Royal Palm Beach, FL":[26.7084,-80.2306],"Greenacres, FL":[26.6276,-80.1253],"Palm Beach Gardens, FL":[26.8234,-80.1387],"Belle Glade, FL":[26.6845,-80.6676],
"Lantana, FL":[26.5865,-80.0521],"Tequesta, FL":[26.9709,-80.1284],"Palm Springs, FL":[26.6359,-80.0962],"Loxahatchee, FL":[26.6837,-80.2798]
};

// Beyond South Florida (2026-10-24: rest of Florida and New York City).
Object.assign(CITY_COORDS,{"Orlando, FL":[28.5383,-81.3792],"Kissimmee, FL":[28.2919,-81.4076],"Winter Park, FL":[28.6,-81.3392],"Tampa, FL":[27.9506,-82.4572],
"St. Petersburg, FL":[27.7676,-82.6403],"Clearwater, FL":[27.9659,-82.8001],"Jacksonville, FL":[30.3322,-81.6557],"St. Augustine, FL":[29.9012,-81.3124],
"Daytona Beach, FL":[29.2108,-81.0228],"Melbourne, FL":[28.0836,-80.6081],"Port St. Lucie, FL":[27.273,-80.3582],"Sarasota, FL":[27.3364,-82.5307],
"Fort Myers, FL":[26.6406,-81.8723],"Naples, FL":[26.142,-81.7948],"Lakeland, FL":[28.0395,-81.9498],"Gainesville, FL":[29.6516,-82.3248],"Ocala, FL":[29.1872,-82.1401],
"Tallahassee, FL":[30.4383,-84.2807],"Pensacola, FL":[30.4213,-87.2169],"Panama City Beach, FL":[30.1766,-85.8055],"Key West, FL":[24.5551,-81.78],
"New York, NY":[40.7306,-73.9866],"Brooklyn, NY":[40.6782,-73.9442],
"Atlanta, GA":[33.749,-84.388],"Savannah, GA":[32.0809,-81.0912],"Augusta, GA":[33.4735,-82.0105],"Athens, GA":[33.9519,-83.3576],"Decatur, GA":[33.7748,-84.2963],
"Charlotte, NC":[35.2271,-80.8431],"Raleigh, NC":[35.7796,-78.6382],"Durham, NC":[35.994,-78.8986],"Asheville, NC":[35.5951,-82.5515],"Wilmington, NC":[34.2257,-77.9447],
"Charleston, SC":[32.7765,-79.9311],"Columbia, SC":[34.0007,-81.0348],"Greenville, SC":[34.8526,-82.394],"Myrtle Beach, SC":[33.6891,-78.8867]} as Record<string,[number,number]>);
export function milesBetween(a:number,b:number,c:number,d:number){const R=3958.8,q=(x:number)=>x*Math.PI/180,dp=q(c-a),dl=q(d-b),z=Math.sin(dp/2)**2+Math.cos(q(a))*Math.cos(q(c))*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(z))}

/** "Fort Lauderdale, FL" -> "fort-lauderdale" */
export const citySlug=(name:string)=>name.replace(/,\s*[A-Za-z]{2}$/,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
export function cityFromSlug(slug:string):string|null{for(const name of Object.keys(CITY_COORDS))if(citySlug(name)===slug)return name;return null}
/** Cities with their own /today landing page: the South Florida core, where
 *  the density check (scripts/density-check.ts) shows listings every day. */
export const SEO_CITIES=["Sunrise, FL","Fort Lauderdale, FL","Hollywood, FL","Coral Springs, FL","Pembroke Pines, FL","Miramar, FL","Plantation, FL","Davie, FL","Weston, FL","Pompano Beach, FL","Deerfield Beach, FL","Miami, FL","Miami Beach, FL","Coral Gables, FL","Hialeah, FL","Aventura, FL","Boca Raton, FL","Delray Beach, FL","Boynton Beach, FL","West Palm Beach, FL","Jupiter, FL","Wellington, FL","Palm Beach Gardens, FL",
 "Orlando, FL","Kissimmee, FL","Winter Park, FL","Tampa, FL","St. Petersburg, FL","Clearwater, FL","Jacksonville, FL","St. Augustine, FL","Daytona Beach, FL","Melbourne, FL",
 "Sarasota, FL","Fort Myers, FL","Naples, FL","Lakeland, FL","Tallahassee, FL","Pensacola, FL","Key West, FL","New York, NY","Brooklyn, NY",
 "Atlanta, GA","Savannah, GA","Augusta, GA","Athens, GA","Decatur, GA","Charlotte, NC","Raleigh, NC","Durham, NC","Asheville, NC","Wilmington, NC","Charleston, SC","Columbia, SC","Greenville, SC","Myrtle Beach, SC"];
