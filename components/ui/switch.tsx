import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn("relative inline-flex h-[14px] w-6 shrink-0 rounded-full bg-muted transition-colors data-checked:bg-[#0077E6] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-2.5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-checked:translate-x-[12px]" />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
