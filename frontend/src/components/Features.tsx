"use client"

import { cn } from "@/lib/utils"
import {
  IconBuildingBank,
  IconCode,
  IconCoin,
  IconLock,
  IconRocket,
  IconShieldCheck,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react"

const features = [
  {
    title: "Open Source First",
    description:
      "Built for the open source community, by developers who believe in collaboration and transparency.",
    icon: <IconCode className="w-8 h-8" />,
  },
  {
    title: "Secure Payments",
    description:
      "Blockchain-powered payments ensure your rewards are safe and instantly delivered.",
    icon: <IconWallet className="w-8 h-8" />,
  },
  {
    title: "Fair Rewards",
    description:
      "Competitive bounties that fairly compensate developers for their valuable contributions.",
    icon: <IconCoin className="w-8 h-8" />,
  },
  {
    title: "Community Driven",
    description: 
      "A thriving ecosystem of developers, maintainers and contributors working together.",
    icon: <IconUsers className="w-8 h-8" />,
  },
  {
    title: "Escrow Protection",
    description:
      "Smart contract escrow system ensures safe and guaranteed payments for completed work.",
    icon: <IconLock className="w-8 h-8" />,
  },
  {
    title: "Enterprise Ready",
    description:
      "Robust infrastructure and tools to help companies manage their open source initiatives.",
    icon: <IconBuildingBank className="w-8 h-8" />,
  },
  {
    title: "Rapid Deployment",
    description:
      "Quick bounty creation and streamlined submission process gets work done faster.",
    icon: <IconRocket className="w-8 h-8" />,
  },
  {
    title: "Quality Assured",
    description: 
      "Built-in code review and verification process ensures high-quality contributions.",
    icon: <IconShieldCheck className="w-8 h-8" />,
  },
]

export function Features() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 relative z-10 py-10 max-w-7xl mx-auto">
      {features.map((feature, index) => (
        <Feature key={feature.title} {...feature} index={index} />
      ))}
    </div>
  )
}

const Feature = ({
  title,
  description,
  icon,
  index,
}: {
  title: string
  description: string
  icon: React.ReactNode
  index: number
}) => {
  return (
    <div
      className={cn(
        "flex flex-col lg:border-r py-10 relative group/feature dark:border-neutral-800",
        (index === 0 || index === 4) && "lg:border-l dark:border-neutral-800",
        index < 4 && "lg:border-b dark:border-neutral-800"
      )}
    >
      {index < 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      {index >= 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      <div className="mb-4 relative z-10 px-10 text-neutral-600 dark:text-neutral-400">
        {icon}
      </div>
      <div className="text-lg font-bold mb-2 relative z-10 px-10">
        <div className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-200 origin-center" />
        <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
          {title}
        </span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-10">
        {description}
      </p>
    </div>
  )
} 