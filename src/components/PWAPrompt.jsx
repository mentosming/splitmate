import React, { useState } from 'react';
import { usePWA } from '../hooks/usePWA';
import { Share, PlusSquare, X } from 'lucide-react';

export default function PWAPrompt() {
    const { isInstallable, installPWA } = usePWA();
    const [dismissed, setDismissed] = useState(false);

    // Determine if it's iOS Safari where beforeinstallprompt is not supported
    const isIos = () => {
        const userAgent = window.navigator.userAgent.toLowerCase();
        return /iphone|ipad|ipod/.test(userAgent);
    };

    const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

    // If already dismissed, don't show
    if (dismissed) return null;

    // For Android/Desktop (supports beforeinstallprompt)
    if (isInstallable) {
        return (
            <div className="fixed bottom-4 left-4 right-4 bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 border border-gray-200 dark:border-gray-700 z-50 animate-in slide-in-from-bottom flex items-center justify-between">
                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Install App</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Add to home screen for a better experience</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={installPWA}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
                    >
                        Install
                    </button>
                    <button
                        onClick={() => setDismissed(true)}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
        );
    }

    // Fallback for iOS (manual instructions)
    if (isIos() && !isInStandaloneMode() && !isInstallable) {
        return (
            <div className="fixed bottom-4 left-4 right-4 bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 border border-gray-200 dark:border-gray-700 z-50 animate-in slide-in-from-bottom">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Install App</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex flex-wrap items-center gap-1">
                            Tap <Share size={14} className="mx-1" /> then "Add to Home Screen" <PlusSquare size={14} className="mx-1" />
                        </p>
                    </div>
                    <button
                        onClick={() => setDismissed(true)}
                        className="p-1 ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
