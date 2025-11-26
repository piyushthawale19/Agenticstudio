'use client'

import {
  EmbedProvider,
  SchematicEmbed as SchematicEmbedComponents,
} from "@schematichq/schematic-components"

const SchematicEmbed = ({
  accessToken,
  componentId,
}: {
  accessToken: string
  componentId: string
}) => {
  if (!accessToken) {
    return null
  }

  return (
    <EmbedProvider>
      <SchematicEmbedComponents accessToken={accessToken} id={componentId} />
    </EmbedProvider>
  )
}

export default SchematicEmbed