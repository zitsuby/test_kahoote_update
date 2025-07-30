"use client";

/**
 * @author: @kokonutui
 * @description: A modern search bar component with action buttons and suggestions
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Send,
    BarChart2,
    Video,
    PlaneTakeoff,
    AudioLines,
    LayoutGrid,
} from "lucide-react";
import useDebounce from "@/hooks/use-debounce";

interface Action {
    id: string;
    label: string;
    icon: React.ReactNode;
    description?: string;
    short?: string;
    end?: string;
}

interface SearchResult {
    actions: Action[];
}

const allActionsSample = [
    {
        id: "1",
        label: "Book tickets",
        icon: <PlaneTakeoff className="h-4 w-4 text-blue-500" />,
        description: "Operator",
        short: "⌘K",
        end: "Agent",
    },
    {
        id: "2",
        label: "Summarize",
        icon: <BarChart2 className="h-4 w-4 text-orange-500" />,
        description: "gpt-4o",
        short: "⌘cmd+p",
        end: "Command",
    },
    {
        id: "3",
        label: "Screen Studio",
        icon: <Video className="h-4 w-4 text-purple-500" />,
        description: "gpt-4o",
        short: "",
        end: "Application",
    },
    {
        id: "4",
        label: "Talk to Jarvis",
        icon: <AudioLines className="h-4 w-4 text-green-500" />,
        description: "gpt-4o voice",
        short: "",
        end: "Active",
    },
    {
        id: "5",
        label: "Kokonut UI - Pro",
        icon: <LayoutGrid className="h-4 w-4 text-blue-500" />,
        description: "Components",
        short: "",
        end: "Link",
    },
];

function ActionSearchBar({
    actions = allActionsSample,
    defaultOpen = false,
    onActionSelect,
    onSearch,
    placeholder = "What's up?",
    label = "Search Commands"
}: {
    actions?: Action[];
    defaultOpen?: boolean;
    onActionSelect?: (action: Action) => void;
    onSearch?: (query: string) => void;
    placeholder?: string;
    label?: string;
}) {
    const [query, setQuery] = useState("");
    const [result, setResult] = useState<SearchResult | null>(null);
    const [isFocused, setIsFocused] = useState(defaultOpen);
    const [isTyping, setIsTyping] = useState(false);
    const [selectedAction, setSelectedAction] = useState<Action | null>(null);
    const debouncedQuery = useDebounce(query, 200);

    useEffect(() => {
        if (!isFocused) {
            setResult(null);
            return;
        }

        if (!debouncedQuery) {
            setResult({ actions: actions });
            return;
        }

        const normalizedQuery = debouncedQuery.toLowerCase().trim();
        const filteredActions = actions.filter((action) => {
            const searchableText = action.label.toLowerCase();
            return searchableText.includes(normalizedQuery);
        });

        setResult({ actions: filteredActions });
        
        if (onSearch) {
            onSearch(normalizedQuery);
        }
    }, [debouncedQuery, isFocused, actions, onSearch]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        setIsTyping(true);
    };

    const container = {
        hidden: { opacity: 0, height: 0 },
        show: {
            opacity: 1,
            height: "auto",
            transition: {
                height: {
                    duration: 0.4,
                },
                staggerChildren: 0.1,
            },
        },
        exit: {
            opacity: 0,
            height: 0,
            transition: {
                height: {
                    duration: 0.3,
                },
                opacity: {
                    duration: 0.2,
                },
            },
        },
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.3,
            },
        },
        exit: {
            opacity: 0,
            y: -10,
            transition: {
                duration: 0.2,
            },
        },
    };

    const handleFocus = () => {
        setSelectedAction(null);
        setIsFocused(true);
    };

    const handleActionClick = (action: Action) => {
        setSelectedAction(action);
        if (onActionSelect) {
            onActionSelect(action);
        }
        setIsFocused(false);
    };

    return (
        <div className="w-full relative">
            <div className="relative">
                <div className="w-full sticky top-0 bg-transparent z-10 pt-4 pb-1">
                    <label
                        className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block"
                        htmlFor="search"
                    >
                        {label}
                    </label>
                    <div className="relative">
                        <Input
                            type="text"
                            placeholder={placeholder}
                            value={query}
                            onChange={handleInputChange}
                            onFocus={handleFocus}
                            onBlur={() =>
                                setTimeout(() => setIsFocused(false), 200)
                            }
                            className="pl-3 pr-9 py-1.5 h-9 text-sm rounded-lg focus-visible:ring-offset-0"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4">
                            <AnimatePresence mode="popLayout">
                                {query.length > 0 ? (
                                    <motion.div
                                        key="send"
                                        initial={{ y: -20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        exit={{ y: 20, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <Send className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="search"
                                        initial={{ y: -20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        exit={{ y: 20, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <Search className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Dropdown container with absolute positioning */}
                <div className="absolute w-full z-50">
                    <AnimatePresence>
                        {isFocused && result && !selectedAction && (
                            <motion.div
                                className="w-full border rounded-md shadow-lg overflow-hidden dark:border-gray-800 bg-white dark:bg-black mt-1"
                                variants={container}
                                initial="hidden"
                                animate="show"
                                exit="exit"
                                style={{ maxHeight: '60vh', overflowY: 'auto' }}
                            >
                                <motion.ul>
                                    {result.actions.map((action) => (
                                        <motion.li
                                            key={action.id}
                                            className="px-3 py-2 flex items-center justify-between hover:bg-gray-200 dark:hover:bg-zinc-900 cursor-pointer rounded-md"
                                            variants={item}
                                            layout
                                            onClick={() => handleActionClick(action)}
                                        >
                                            <div className="flex items-center gap-2 justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-500">
                                                        {action.icon}
                                                    </span>
                                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                        {action.label}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {action.description}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-400">
                                                    {action.short}
                                                </span>
                                                <span className="text-xs text-gray-400 text-right">
                                                    {action.end}
                                                </span>
                                            </div>
                                        </motion.li>
                                    ))}
                                </motion.ul>
                                <div className="mt-2 px-3 py-2 border-t border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                        <span>Press ⌘K to open commands</span>
                                        <span>ESC to cancel</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

export default ActionSearchBar; 