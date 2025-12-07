import React from 'react';
import { useAppContext } from '../../contexts/AppContext';

// UPDATE THIS LINE:
const TEST_IMAGE_URL = "/test.png";

const DebugTest: React.FC = () => {
    const { inferFromUrl, status } = useAppContext();
    return (
        <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2 items-end pointer-events-auto">
            <div className="bg-black/80 backdrop-blur text-white p-3 rounded-lg border border-white/10 shadow-xl text-xs max-w-[200px]">
                <p className="mb-2 font-bold text-gray-300">Debugger</p>
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => inferFromUrl(TEST_IMAGE_URL)}
                        disabled={status === 'loading' || status === 'error'}
                        className={`
                            px-3 py-2 rounded font-bold transition-all
                            ${status !== 'loading' && status !== 'error'
                                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                : 'bg-gray-700 text-gray-400 cursor-not-allowed'}
                        `}
                    >
                        {status === 'loading' ? 'Testing...' : 'Test Reference Image'}
                    </button>
                    <p className="text-[10px] text-gray-500">
                        Check console (F12) for raw output.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DebugTest;