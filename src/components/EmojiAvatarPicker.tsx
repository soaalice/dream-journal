import React, { useState, useEffect } from 'react';

interface EmojiAvatarPickerProps {
    initialAvatarUrl?: string;
    onAvatarChange: (avatarUrl: string) => void;
    isDarkMode?: boolean;
    buttonClassName?: string;
    previewClassName?: string;
}

const EmojiAvatarPicker: React.FC<EmojiAvatarPickerProps> = ({
    initialAvatarUrl = '',
    onAvatarChange,
    isDarkMode = false,
    buttonClassName = '',
    previewClassName = ''
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAvatar, setSelectedAvatar] = useState<string>(initialAvatarUrl);

    const emojiOptions = {
        eyes: [
            'closed', 'closed2', 'crying', 'cute', 'glasses',
            'love', 'pissed', 'plain', 'sad', 'shades',
            'sleepClose', 'stars', 'tearDrop', 'wink', 'wink2'
        ],
        mouth: [
            'cute', 'drip', 'faceMask', 'kissHeart', 'lilSmile',
            'pissed', 'plain', 'sad', 'shout', 'shy',
            'sick', 'smileLol', 'smileTeeth', 'tongueOut', 'wideSmile'
        ],
        color: ['ffadad', 'ffd6a5', 'fdffb6', 'caffbf', '9bf6ff', 'a0c4ff', 'bdb2ff', 'ffc6ff']
    };

    const [selectedOptions, setSelectedOptions] = useState({
        eyes: 'plain',
        mouth: 'smileTeeth',
        color: 'a0c4ff'
    });

    const generateDiceBearUrl = (options: typeof selectedOptions) => {
        return `https://api.dicebear.com/8.x/fun-emoji/svg?eyes=${options.eyes}&mouth=${options.mouth}&backgroundColor=${options.color}`;
    };

    useEffect(() => {
        if (initialAvatarUrl?.includes('dicebear')) {
            try {
                const url = new URL(initialAvatarUrl);
                const params = new URLSearchParams(url.search);

                setSelectedOptions({
                    eyes: params.get('eyes') || 'plain',
                    mouth: params.get('mouth') || 'smileTeeth',
                    color: params.get('backgroundColor')?.replace('#', '') || 'a0c4ff'
                });
            } catch (e) {
                console.error("Error parsing avatar URL:", e);
            }
        }
    }, [initialAvatarUrl]);

    useEffect(() => {
        const newAvatar = generateDiceBearUrl(selectedOptions);
        setSelectedAvatar(newAvatar);
    }, [selectedOptions]);

    const handleOptionChange = (type: keyof typeof selectedOptions, value: string) => {
        setSelectedOptions(prev => ({
            ...prev,
            [type]: value
        }));
    };

    const handleRandomizeAvatar = (e: React.MouseEvent) => {
        e.preventDefault();
        setSelectedOptions({
            eyes: emojiOptions.eyes[Math.floor(Math.random() * emojiOptions.eyes.length)],
            mouth: emojiOptions.mouth[Math.floor(Math.random() * emojiOptions.mouth.length)],
            color: emojiOptions.color[Math.floor(Math.random() * emojiOptions.color.length)]
        });
    };

    const handleSaveAvatar = () => {
        onAvatarChange(selectedAvatar);
        setIsModalOpen(false);
    };

    return (
        <div className="emoji-avatar-picker">
            <div className="flex items-center space-x-4">
                <img
                    src={selectedAvatar}
                    alt="Selected Avatar"
                    className={`w-12 h-12 rounded-full object-cover border-2 border-purple-500 ${previewClassName}`}
                />
                <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className={`px-4 py-2 rounded-md transition-colors duration-200 ${isDarkMode
                            ? 'bg-gray-700 text-white hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        } ${buttonClassName}`}
                >
                    Customize Avatar
                </button>
            </div>

            {/* Avatar Customization Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex justify-center items-center z-50">
                    <div className={`p-6 rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto ${isDarkMode ? 'bg-gray-800' : 'bg-white'
                        }`}>
                        <h3 className="text-xl font-semibold mb-4">Customize Your Emoji Avatar</h3>

                        <div className="flex flex-col items-center mb-6">
                            <img
                                src={selectedAvatar}
                                alt="Preview Avatar"
                                className="w-32 h-32 rounded-full border-4 border-purple-500 p-1 mb-4"
                            />
                            <button
                                type="button"
                                onClick={handleRandomizeAvatar}
                                className={`px-4 py-2 rounded-md mb-2 ${isDarkMode
                                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                    }`}
                            >
                                Randomize
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-2">Eyes</label>
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                    {emojiOptions.eyes.map(eye => (
                                        <button
                                            key={eye}
                                            type="button"
                                            onClick={() => handleOptionChange('eyes', eye)}
                                            className={`px-2 py-1 rounded text-sm transition-colors truncate ${selectedOptions.eyes === eye
                                                    ? 'bg-purple-500 text-white'
                                                    : isDarkMode
                                                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                                                        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                                                }`}
                                        >
                                            {eye}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Mouth</label>
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                    {emojiOptions.mouth.map(mouth => (
                                        <button
                                            key={mouth}
                                            type="button"
                                            onClick={() => handleOptionChange('mouth', mouth)}
                                            className={`px-2 py-1 rounded text-sm transition-colors truncate ${selectedOptions.mouth === mouth
                                                    ? 'bg-purple-500 text-white'
                                                    : isDarkMode
                                                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                                                        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                                                }`}
                                        >
                                            {mouth}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Background Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {emojiOptions.color.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => handleOptionChange('color', color)}
                                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${selectedOptions.color === color
                                                    ? 'border-purple-500 scale-110'
                                                    : 'border-transparent'
                                                }`}
                                            style={{ backgroundColor: `#${color}` }}
                                            title={`#${color}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end space-x-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className={`px-4 py-2 rounded-md ${isDarkMode
                                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                                        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                                    }`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveAvatar}
                                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                            >
                                Save Avatar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmojiAvatarPicker;