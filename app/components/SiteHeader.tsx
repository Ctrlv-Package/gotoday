import Link from "next/link";
import BackToEvents from "./BackToEvents";
import {LangPicker} from "./Lang";
import NavMe from "./NavMe";

/** The same top bar on every page except the home page: logo, a clear way back to events, and who's signed in. */
export default function SiteHeader({back=true,me=true,extra}:{back?:boolean;me?:boolean;extra?:React.ReactNode}){
 return <header className="detailHeader"><div className="detailWrap row">
  <Link href="/?fresh=1" className="detailLogo">Go<span>Today</span></Link>
  <span className="navRight">{extra}{back&&<BackToEvents/>}<LangPicker/>{me&&<NavMe/>}</span>
 </div></header>;
}
