// The production icon, as GitHub shows the cod3 app, whatever this build's channel.
import appIconUrl from "../../../../assets/prod/cod3-black-web-apple-touch-180.png";

export function Cod3AppIcon(props: { readonly className?: string }) {
  return <img src={appIconUrl} alt="" className={props.className} />;
}
