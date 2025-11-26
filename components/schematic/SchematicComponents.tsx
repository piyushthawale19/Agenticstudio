import { getTemporaryAccessToken } from "@/actions/getTemporaryAccessToken";
import SchematicEmbed from "./SchematicEmbed";

async function SchematicComponent({ componentId }: { componentId: string }) {

  if (!componentId) {
    return null;
  }
  // Get access token
  const accessToken = await getTemporaryAccessToken();

  if (!accessToken) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        We couldn&apos;t load your billing portal right now. Please refresh the page or try again
        after signing in.
      </div>
    );
  }

  return <SchematicEmbed accessToken={accessToken} componentId={componentId} />

}

export default SchematicComponent;
