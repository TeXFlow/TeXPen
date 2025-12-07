import React from 'react';
import { AppProvider } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { HistoryProvider } from './contexts/HistoryContext';
import Main from './components/layout/Main';

const App: React.FC = () => {
    return (
        <ThemeProvider>
            <HistoryProvider>
                <AppProvider>
                    <Main />
                </AppProvider>
            </HistoryProvider>
        </ThemeProvider>
    );
};

export default App;