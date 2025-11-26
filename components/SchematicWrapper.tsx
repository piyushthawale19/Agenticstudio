"use client";

import { useUser } from "@clerk/nextjs";
import { useSchematicEvents } from "@schematichq/schematic-react";
import { useEffect } from "react";

const SchematicWrapper = ({ children }: { children: React.ReactNode }) => {
  const { identify } = useSchematicEvents();
  const { user } = useUser();

  useEffect(() => {
    const userName =
      user?.username ??
      user?.emailAddresses?.[0]?.emailAddress ??
      user?.fullName ??
      user?.id;

    if (user?.id) {
      identify({
        //company level key
        company: {
          keys: {
            id: user.id,
          },
          name: userName,
        },

        //user level key

        keys: {
          userId: user.id,
        },
        name: userName,
      });
    }
  }, [user, identify]);

  return children;
};

export default SchematicWrapper;
