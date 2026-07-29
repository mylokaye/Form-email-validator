import * as React from "react"

import { cn } from "@/lib/utils"

function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="badge"
      className={cn("inline-flex h-5 items-center rounded-[6px] bg-[#CAFACE] px-2 text-[13px] leading-4 font-medium text-[#15B042]", className)}
      {...props}
    />
  )
}

export { Badge }
